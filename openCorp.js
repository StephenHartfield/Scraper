const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const request = require("request");
const parser = require("parse-address"); 
const puppeteer = require("puppeteer");


const companiesList = require("./ct_companies.json");
let finalResult = [];
let count = 0;

// companiesList.map((company, idx) => {
for (let i = 0; i < 137; i++) {
    const company = companiesList[i];
    console.log(company);
    const searchTerm = company.replace(" ", "%20");

    const siteUrl = `https://opencorporates.com/companies/us_ct?q=${searchTerm}&utf8=%E2%9C%93`;
    request(
        {
            method: "GET",
            url:
                "http://api.scraperapi.com/?api_key=54e9b0fb54b2de5c04096c232e2ae5ab&url=" +
                siteUrl,
            headers: {
                Accept: "application/json"
            }
        },
        async () => {
            const fetchData = async site => {
                const result = await axios.get(site);
                return cheerio.load(result.data);
            };

            async function getData() {
                const people = [];
                async function getMatchedHref() {
                    const $ = await fetchData(siteUrl);

                    const entities = [];
                    let el = {};
                    if ($('li.active').length > 1) {
                        $("div ul li.active").each((index, element) => {
                            if ($(element).find("a").length) {
                                el["name"] = $(element)
                                    .find("a")
                                    .text();
                                el["href"] = $(element)
                                    .find("a.company_search_result")
                                    .attr("href");
                                entities.push(el);
                                el = {};
                            }
                        });
                        const fixedEntities = entities.map(val => {
                            return { name: val['name'].toUpperCase().replace(/[^\w\s-&]|_/g, "").trimRight(), href: val['href'] };
                        });
                        const fixedCompany = company.toUpperCase().replace(/[^\w\s-&]|_/g, "").trimRight();
                        const matched = fixedEntities.find(val => val.name == fixedCompany);
                        if (matched) {
                            return matched.href;
                        } else {
                            return null;
                        }
                    } else {
                        return null;
                    }
                }
                const matchedHref = await getMatchedHref();
                if (matchedHref) {
                    const $$ = await fetchData(`https://opencorporates.com${matchedHref}`);
                    async function getRedirect() {
                        return $$('dd a.url.external').attr('href');
                    }
                    const registryHref = await getRedirect();
                    // 
                    if (registryHref) {
                        console.log('in registry page');
                        async function getOfficerData() {
                            const page = await fetchData(registryHref);

                            let people = [];
                            let data = [];
                            page('table tr td table tr td table tr:nth-child(3) td table tr').each((idx, el) => {
                                data.push(page(el).text());
                            })
                            data = data.slice(2);
                            data = data.map(val => {
                                val = val.split('\n');
                                val = val.filter(el => el.trim() !== '');
                                return val.map(el => el.trim());
                            });
        
                            for (let i = 0; i < data.length; i++) {
                                const individual = data[i];
                                const nameAndTitle = individual[0].trimRight();
                                const splitData = nameAndTitle.split(/[ ]{2,}/);
        
                                const parsedAddress = parser.parseLocation(individual[2]);
        
                                const person = { company: company };
                                const splitName = splitData[0].split(' ');
                                if (splitName.length == 2) {
                                    person['firstName'] = splitName[0];
                                    person['lastName'] = splitName[1];
                                } else if (splitName.length == 3) {
                                    person["firstName"] = splitName[0] + ' ' + splitName[1];
                                    person["lastName"] = splitName[2];
                                } else {
                                    person['fullName'] = splitName.join();
                                }

                                person['status'] = splitData[1].trimLeft();
                                person['address'] = parsedAddress.number + ' ' + parsedAddress.street + ' ' + parsedAddress.type;
                                person['city'] = parsedAddress.city;
                                person['state'] = parsedAddress.state;
                                person['zipcode'] = parsedAddress.zip;

                                people.push(person);
                            }
                            return people;
                        }
                        return await getOfficerData();
                    } else {
                        const addressLines = $$('dd.registered_address ul.address_lines li').eq(0).text();
                        let addressArray = addressLines.split(',');
                        if (addressArray[addressArray.length - 1] == ' USA') {
                            addressArray = addressArray.filter(val => val !== ' USA');
                        }
    
                        let address2 = '';
                        if (addressArray.length == 5) {
                            address2 = addressArray[1];
                            addressArray = addressArray.filter((line, idx) => idx !== 1);
                        }
    
                        const parsedAddress = parser.parseLocation(addressArray.join());
                        let members = [];
                        let el = {};
                        $$('dd ul.attribute_list li.attribute_item').each((idx, element) => {
                            if ($$(element).find("a").length) {
                                el["name"] = $$(element).find("a").text();
                                let status = $$(element).text();
                                el["status"] = status.replace(/[^\w\s-&]|_/g, "").trimLeft().toUpperCase();
                            }
                            members.push(el);
                            el = {};
                        })
                        for (let i = 0; i < members.length; i++) {
                            const person = { company: company };

                            const splitName = members[i].name.split(" ");
                            if (splitName.length == 2) {
                                person["firstName"] = splitName[0];
                                person["lastName"] = splitName[1];
                            } else if (splitName.length == 3) {
                                person["firstName"] = splitName[0] + ' ' + splitName[1];
                                person["lastName"] = splitName[2];
                            } else {
                                person["fullName"] = splitName.join();
                            }
                            person['address'] = parsedAddress.number + ' ' + parsedAddress.street + ' ' + parsedAddress.type || '';
                            if (address2) {
                                person['address2'] = address2.trimLeft();
                            }
                            person['city'] = parsedAddress.city;
                            person['state'] = parsedAddress.state;
                            person['zipcode'] = parsedAddress.zip;

                            people.push(person);
                        }
                        return people;
                    }
                } else {
                    return 'No Data Found';
                }
            }
            const people = await getData();
            // console.log(people);
            finalResult.push(people);
            if (finalResult.length == 137) {
                console.log('writing ...');
                let finalJson = JSON.stringify(finalResult);
                fs.writeFileSync(`./CT1.json`, finalJson, 'utf-8');
            }
            
        } //function within request
    ); //request()
} //for loop
       





// if (officers) {
            //     let person = {};
            //     async function getOfficerData(href) {
            //         const $$$ = await fetchData(`https://opencorporates.com${href}`);

            //         const company = $$$('div#attributes dl.attributes dd.company a').text();
            //         const name = $$$('div#attributes dl.attributes dd.name a').text();
            //         const address = $$$('div#attributes dl.attributes').text();
            //         const status = $$$('div#attributes dl.attributes dd.position').text();

            //         const page = await browser.newPage();
            //         await page.waitFor(1000);
            //         await page.goto(`https://opencorporates.com${href}`, { waitUntil: "load", timeout: 0 });
            //         const attributes = await page.$("div#attributes dl.attributes");
            //         const text = await page.evaluate(attributes => attributes.textContent, attributes);


            //         console.log(text);
            //     }
            //     getOfficerData(officers[0].href);
            // }
//         let tries = 0;
//         async function getData() {
//           const $$ = await fetchData(
//             `http://search.sunbiz.org${activeEntities[tries].href}`
//           );
//           if ($$(".searchResultDetail div:nth-child(7)").length === 0) {
//             tries++;
//             return getData();
//           } else {
//             return $$(".searchResultDetail div:nth-child(7)").text();
//           }
//         }
//         const data = await getData();

//         const fixedData = data.split("\n");
//         const filtered = fixedData.filter(el => /\S/.test(el));

//         const trimmed = filtered.map(el => {
//           el = el.replace(/^\s+/g, "");
//           el = el.replace(/\s+$/g, "");
//           return el;
//         });
//         let count = 0;
//         let person = {};
//         let final = [];
//         let isFive = false;
//         for (var i = 2; i < trimmed.length; i++) {
//           if (trimmed[i].match(/^Title/)) {
//             person = {};
//             person["company"] = company;
//             count = 0;
//             person["status"] = trimmed[i];
//             isFive = /([A-Z]{2}) (\d{5})/.test(trimmed[i + 4]);
//           }
//           if (count === 1) {
//             if (trimmed[i].indexOf(",") > -1) {
//               const splitName = trimmed[i].split(",");
//               person["lastName"] = splitName[0];
//               person["firstName"] = splitName[1].replace(/^\s+/g, "");
//             } else {
//               person["fullName"] = trimmed[i];
//             }
//           }
//           if (count == 2) {
//             person["address"] = trimmed[i];
//           }
//           if (count == 3) {
//             if (isFive) {
//               person["address2"] = trimmed[i];
//               i++;
//             }
//             const splitAddress = trimmed[i].split(",");
//             person["city"] = splitAddress[0].replace(/,/g, "");
//             let splitStateAndZip;
//             if (splitAddress[1] == "") {
//               splitStateAndZip = splitAddress[2];
//             } else {
//               splitStateAndZip = splitAddress[1];
//             }
//             splitStateAndZip = splitStateAndZip.trim().split(" ");
//             person["state"] = splitStateAndZip[0];
//             person["zipcode"] = splitStateAndZip[1];

//             final.push(person);
//           }
//           count++;
//         }
//         // console.log(final);
//         return final;
//       }
//       // scrape();
//       const returnedFinal = await scrape();
//       finalResult.push(returnedFinal);

//       if (idx === companiesList.length - 1) {
//         setTimeout(() => {
//           console.log("writing ...");
//           let finalJson = JSON.stringify(finalResult);
//           fs.writeFileSync("./FL2.json", finalJson, "utf-8");
//         }, 3000);
//       }
//     }
//   );
// });
