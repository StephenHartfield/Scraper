const puppeteer = require('puppeteer');
const request = require("request");
const fs = require('fs');
const parser = require("parse-address"); 

function parseAddress(splitAddress) {
    const addressObj = {};
    if (splitAddress.length > 1) {
        const address = splitAddress[0];
        let addressLine = splitAddress[1];
        addressLine = addressLine.replace(address, "");
        addressLine = addressLine.trimLeft();

        let zipcode = addressLine.match(/\d+$/g);
        if (zipcode && zipcode.length < 5) {
            let hyphenIdx = addressLine.indexOf("-");
            if (hyphenIdx > -1) {
                addressLine = addressLine.slice(0, hyphenIdx);
                zipcode = addressLine.match(/\d+$/g);
            }
        }
        addressLine = addressLine.replace(zipcode, "");
        addressLine = addressLine.trimRight();
        const state = addressLine.match(/[A-Z]{2}$/g);
        addressLine = addressLine.replace(state, "");
        addressLine = addressLine.trimRight();
        const city = addressLine;

        addressObj["address"] = address ? address : "N/A";
        addressObj["city"] = city ? city : "N/A";
        addressObj["state"] = state ? state.join() : "N/A";
        addressObj["zipcode"] = zipcode ? zipcode.join() : "N/A";
        return addressObj;
    } else {
        //get address parser method;
        const parsedAddress = parser.parseLocation(splitAddress[0]);
        addressObj["address"] = parsedAddress.number && parsedAddress.street ? parsedAddress.number + ' ' + parsedAddress.street : "N/A";
        addressObj["city"] = parsedAddress.city ? parsedAddress.city : "N/A";
        addressObj["state"] = parsedAddress.state ? parsedAddress.state : "N/A";
        addressObj["zipcode"] = parsedAddress.zipcode ? parsedAddress.zipcode : "N/A";
        return addressObj;
    }
}

const companies = require('./company_names/pa_companies.json');
let result = [];
(async () => {
    
    const url = `https://www.corporations.pa.gov/Search/corpsearch`;
    const browser = await puppeteer.launch();
    try {
        for (let i = 0; i < 1; i++) {
            const idx = i;
            let searchTerm =
              'NVR INC'
                // companies[i];
            request(
                {
                    method: 'GET',
                    url: 'http://api.scraperapi.com/?api_key=54e9b0fb54b2de5c04096c232e2ae5ab&url=' + url,
                    headers: {
                        Accept: 'application/json',
                    },
                },
                async () => {
                    async function scrape(searchTerm) {
                        try {
                            const page = await browser.newPage();
                            await page.waitFor(1000);
                            await page.goto(url, { waitUntil: "load", timeout: 0 });
                            await page.waitForSelector('#txtSearchTerms');
                            await page.evaluate(searchTerm => {
                                let input = document.querySelector("#txtSearchTerms");
                                input.value = searchTerm;
                            }, searchTerm);
                            await page.click("#btnSearch");
                            let count = 0;
                            let found = false;
                            async function paginationHandle() {
                                await page.waitForSelector('#btnBackToSearchBottom');
                                const names = await page.evaluate(() => {
                                    let names = Array.from(document.querySelectorAll("table tr td a"));
                                    return names.map(name => name.textContent);
                                });

                                const fixedNames = names.map(name => {
                                    return name.toUpperCase().replace(/[^\w\s-&]|_/g, "").trimRight();
                                });
                                searchTerm = searchTerm.toUpperCase().replace(/[^\w\s-&]|_/g, "").trimRight();
                                let matchName = "";
                                let matchEntityNum = "";
                                for (let i = 0; i < fixedNames.length; i++) {
                                    if (fixedNames[i] == searchTerm) {
                                        matchName = fixedNames[i];
                                        matchEntityNum = fixedNames[i + 1];
                                    }
                                }
                                if (!matchName) {
                                    if (searchTerm.indexOf("LLC") > -1) { searchTerm = searchTerm.replace('LLC', 'LIMITED LIABILITY COMPANY') };
                                    if (searchTerm.indexOf("LLP") > -1) { searchTerm = searchTerm.replace('LLC', 'LIMITED LIABILITY PARTNERSHIP') };
                                    if (searchTerm.indexOf("LP") > -1) { searchTerm = searchTerm.replace('LLC', 'LIMITED PARTNERSHIP') };
                                    if (searchTerm.indexOf("INC") > -1) { searchTerm = searchTerm.replace('LLC', 'INCORPORATED') };
                                    console.log(searchTerm);
                                    for (let i = 0; i < fixedNames.length; i++) {
                                        if (fixedNames[i] == searchTerm) {
                                            matchName = fixedNames[i];
                                            matchEntityNum = fixedNames[i + 1];
                                        }
                                    }
                                }
                                console.log(matchName);
                                if (matchName) {
                                    await page.waitFor(200);
                                    await page.evaluate(matchEntityNum => {
                                        let names = document.querySelectorAll("table tr td a");
                                        for (let i = 0; i < names.length; i++) {
                                            if (names[i].innerHTML == matchEntityNum) {
                                                names[i].click();
                                            }
                                        }
                                    }, matchEntityNum);
                                    found = true;
                                } else {
                                    try {
                                        await page.waitForSelector('#gvResults_next');
                                        await page.$('#gvResults_next')
                                            .then((el) => el.getProperty("className")) // Returns a jsHandle of that property
                                            .then((cn) => cn.jsonValue()) // This converts the className jsHandle to a space delimitedstring       
                                            .then((classNameString) => classNameString.split(" ")) // Splits into array
                                            .then(async (x) => {
                                                const nextDisabled = x.find(val => val == 'disabled');
                                                if (!nextDisabled) {
                                                    count++;
                                                    await page.click("#gvResults_next");
                                                    await page.waitFor(20);
                                                    await paginationHandle();
                                                } else {
                                                    found = false;
                                                }
                                            });
                                    } catch (error) {
                                        found = false;
                                    }
                                }
                            }
                            await paginationHandle();
                            if (!found) {
                                console.log('not found');
                                return {};
                            } else {
                                await page.waitForNavigation();

                                const values = await page.evaluate(() => {
                                    const tableValues = Array.from(
                                        document.querySelectorAll(".row .col-md-6:nth-child(2) table tr td")
                                    );
                                    return tableValues.map(val => val.textContent);
                                });
                                if (values.length > 0) {
                                    let person = {};
                                    let innerPeople = [];
                                    for (let i = 0; i < values.length; i++) {
                                        person["company"] = searchTerm;
                                        if (values[i] === "Name") {
                                            let fullName = values[i + 1].split(" ");
                                            fullName = fullName.filter(val => val !== " " && val !== "");
                                            if (fullName.length > 1) {
                                                if (fullName.length > 2) {
                                                    person["firstName"] = fullName[0] + " " + fullName[1];
                                                    person["lastName"] = fullName[2];
                                                } else {
                                                    person["firstName"] = fullName[0];
                                                    person["lastName"] = fullName[1];
                                                }
                                            } else {
                                                person["fullName"] = fullName.join(" ");
                                            }
                                        }
                                        if (values[i] === "Title") {
                                            person["status"] = values[i + 1];
                                        }
                                        if (values[i] === "Address") {
                                            let fullAddress = values[i + 1];

                                            let splitAddress = fullAddress.split(/[ ]{2,}/);
                                            if (splitAddress[0] && splitAddress[1]) {
                                                const addressObj = parseAddress(splitAddress);
                                                person['address'] = addressObj.address;
                                                person['city'] = addressObj.city;
                                                person['state'] = addressObj.state;
                                                person['zipcode'] = addressObj.zipcode;
                                            } else {
                                                const t1Values = await page.evaluate(() => {
                                                    const tableValues = Array.from(
                                                        document.querySelectorAll(".row .col-md-6:nth-child(1) table tr td")
                                                    );
                                                    return tableValues.map(val => val.textContent);
                                                });
                                                const compAddress = t1Values[t1Values.length - 1];
                                                let splitAddress = compAddress.split(/ +(?= )/g);
                                                splitAddress = splitAddress.map(val => val = val.trimLeft());
                                                splitAddress.pop();
                                                if (splitAddress.length == 3) {
                                                    splitAddress[1] = splitAddress[0] + ' ' + splitAddress[1];
                                                    splitAddress = splitAddress.slice(1);
                                                }
                                                if (splitAddress.length == 1) {
                                                    splitAddress.split(',');
                                                }
                                                const addressObj = parseAddress(splitAddress);
                                                if (addressObj) {
                                                    person['address'] = addressObj.address;
                                                    person['city'] = addressObj.city;
                                                    person['state'] = addressObj.state;
                                                    person['zipcode'] = addressObj.zipcode;
                                                }
                                            }
                                        }
                                        innerPeople.push(person);
                                        person = {};
                                    }
                                    console.log(innerPeople);
                                    return innerPeople;
                                } else {
                                    person = {company: searchTerm};
                                    const t1Values = await page.evaluate(() => {
                                        const tableValues = Array.from(
                                            document.querySelectorAll(".row .col-md-6:nth-child(1) table tr td")
                                        );
                                        return tableValues.map(val => val.textContent);
                                    });
                                    const compAddress = t1Values[t1Values.length - 1];
                                    let splitAddress = compAddress.split(/ +(?= )/g);
                                    splitAddress = splitAddress.map(val => val = val.trimLeft());
                                    splitAddress.pop();
                                    if (splitAddress.length == 3) {
                                        splitAddress[1] = splitAddress[0] + ' ' + splitAddress[1];
                                        splitAddress = splitAddress.slice(1);
                                    }

                                    const addressObj = parseAddress(splitAddress);
                                    if (addressObj) {
                                        person['address'] = addressObj.address;
                                        person['city'] = addressObj.city;
                                        person['state'] = addressObj.state;
                                        person['zipcode'] = addressObj.zipcode;
                                        return [person];
                                    } else {
                                        return null;
                                    }
                                }
                            }
                        } catch (e) {
                            console.log(e);
                        }
                    }
                    let people = await scrape(searchTerm);
                    if (people && people.length > 0) {
                        result.push(people);
                        people = [];
                    } else {
                        result.push('No Data Found');
                    }
                    if (result.length == 1) {
                        console.log("writing ...");
                        setTimeout(() => {
                            result = result.filter(val => val != 'No Data Found');
                            let finalJson = JSON.stringify(result);
                            fs.writeFileSync("./PAtest.json", finalJson, "utf-8");
                            setTimeout(() => browser.close(), 1000);
                        }, 5000);
                    }
                }
            )
        }
    } catch (e) {
        try {
            await page.reload(); // soft fix
        } catch (recoveringErr) {
            // unable to reload the page, hard fix
            try {
                await browser.close();
            } catch (err) {
                // browser close was not necessary
                // you might want to log this error
            }
            browser = await puppeteer.launch(/* .. */);
            page = await browser.newPage();
        }
    }
})();

