const axios = require("axios");
const cheerio = require('cheerio');
const fs = require('fs');
const request = require('request-promise');
const pLimit = require('p-limit');

const companiesList = require('./company_names/more_fl_comps');
let finalResult = [];
let count = 0;

const limit = pLimit(50);
const input = companiesList.map((company, idx) => {

    const searchTerm = company.replace(/ /g, '%20');

    const siteUrl = `http://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults?inquiryType=EntityName&searchNameOrder=HOOSEOZ1&searchTerm=${searchTerm}`;
        
    limit(() => request(
        {
            method: 'GET',
            url: 'http://api.scraperapi.com/?api_key=54e9b0fb54b2de5c04096c232e2ae5ab&url=' + siteUrl,
            headers: {
                Accept: 'application/json',
            },
        })
        .then(async () => {

            const fetchData = async (site) => {
                const result = await axios.get(site);
                return cheerio.load(result.data);
            };

            async function scrape() {
                const $ = await fetchData(siteUrl);

                const entities = new Set();
                let el = {};
                $("table > tbody > tr > td").each((index, element) => {
                    if ($(element).find('a').length) {
                        el['name'] = ($(element).find('a').text());
                        el['href'] = ($(element).find('a').attr('href'));
                    } else {
                        const text = $(element).text();
                        if (text == 'Active' || text == 'INACT' || text == 'InActive' || text == 'CROSS RF') {
                            el['status'] = text;
                        } else {
                            el['docNum'] = text;
                        }
                    }
                    if (Object.keys(el).length == 4) {
                        entities.add(el);
                        el = {};
                    }
                });

                const entitiesArray = [...entities];

                // writing our list of returned companies to a JSON file
                // let jsonString = JSON.stringify(entitiesArray);
                // fs.writeFileSync('./output.json', jsonString, 'utf-8');

                //need to determine best match for user - remove inactive and duplicates
                const activeEntities = entitiesArray.filter((entity, idx) => entity.status == 'Active' && entitiesArray.indexOf(entity) === idx);

                //narrowing it down to closest match
                // let matched;
                // let matched = activeEntities.find(entity => entity.name.match(new RegExp(`${input}`, "i")));
                // if (!matched) {
                //     matched = activeEntities[0];
                // }
                // console.log(matched);

                let tries = 0;
                async function getData() {
                    const $$ = await fetchData(`http://search.sunbiz.org${activeEntities[tries].href}`);
                    if ($$(".searchResultDetail div:nth-child(7)").length === 0) {
                        tries++;
                        return getData();
                    } else {
                        return $$(".searchResultDetail div:nth-child(7)").text();
                    }
                }
                const data = await getData();

                const fixedData = data.split('\n');
                const filtered = fixedData.filter(el => /\S/.test(el));

                const trimmed = filtered.map(el => {
                    el = el.replace(/^\s+/g, '');
                    el = el.replace(/\s+$/g, '');
                    return el;
                })
                let count = 0;
                let person = {};
                let final = [];
                let isFive = false;
                for (var i = 2; i < trimmed.length; i++) {
                
                    if ((trimmed[i]).match(/^Title/)) {
                        person = {};
                        person['company'] = company;
                        count = 0;
                        person['status'] = trimmed[i];
                        isFive = /([A-Z]{2}) (\d{5})/.test(trimmed[i + 4])
                    }
                    if (count === 1) {
                        if (trimmed[i].indexOf(',') > -1) {
                            const splitName = trimmed[i].split(',');
                            person['lastName'] = splitName[0];
                            person['firstName'] = splitName[1].replace(/^\s+/g, '');
                        } else {
                            person['fullName'] = trimmed[i];
                        }
                    }
                    if (count == 2) {
                        person['address'] = trimmed[i];
                    }
                    if (count == 3) {
                        if (isFive) {
                            person['address2'] = trimmed[i];
                            i++;
                        }
                        const splitAddress = trimmed[i].split(',');
                        person['city'] = splitAddress[0].replace(/,/g, '');
                        let splitStateAndZip;
                        if (splitAddress[1] == '') {
                            splitStateAndZip = splitAddress[2];
                        } else {
                            splitStateAndZip = splitAddress[1];
                        }
                        splitStateAndZip = splitStateAndZip.trim().split(' ');
                        person['state'] = splitStateAndZip[0];
                        person['zipcode'] = splitStateAndZip[1];
                        
                        final.push(person);
                    }
                    count++;
                }
                // console.log(final);
                return final;
            };
            // scrape();
            const returnedFinal = await scrape();
            finalResult.push(returnedFinal);
            if(idx == companiesList.length-1) {
                setTimeout(() => {
                    console.log('writing ...');
                    let finalJson = JSON.stringify(finalResult);
                    fs.writeFileSync('./LargeFLOutput.json', finalJson, 'utf-8');
                }, 2000);
            }
        })
        .catch((e) => {
            console.log('err ' + e);
        })
    );
});


// (async () => {
//     console.log('begin waiting ...')
//     const result = await Promise.all(input);

//     console.log('writing ...');
//     let finalJson = JSON.stringify(result);
//     fs.writeFileSync('./FL2test.json', finalJson, 'utf-8');
// })