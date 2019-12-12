const puppeteer = require("puppeteer");
const request = require("request");
const fs = require("fs");

const companies = require("./ct_companies.json");
const result = [];

const url = "https://www.concord-sots.ct.gov/CONCORD/online?sn=PublicInquiry&eid=9740";

(async () => {
    const browser = await puppeteer.launch({headless: false});

    const result = [];
    let count = 0;
    // request(
    //     {
    //         method: 'GET',
    //         url: 'http://api.scraperapi.com/?api_key=54e9b0fb54b2de5c04096c232e2ae5ab&url=' + url,
    //         headers: {
    //             Accept: 'application/json',
    //         },
    //     },
        (async () => {
            async function scrape() {
                if (count == companies.length) {
                    console.log('full count');
                    return;
                }
                const page = await browser.newPage();
                let searchTerm = companies[count];
                console.log(searchTerm);
                await page.goto(url);
                // const frames = await page.frames();
                // const html = await page.evaluate(() => {
                //     return window.frames[0].document.querySelector('html body');
                // });
                const frame = (await (await page.frames()[0].childFrames()))[1]; 
                const text = await frame.$eval('#txtBusName', el => el);
                text.value = searchTerm;
                console.log(text);

                const button = await frame.$eval('input[name=submittor]', el => el.outerHTML);
                await page.click(button);
                await page.waitForNavigation();
                await page.screenshot({ path: './myImage.png', type: 'png' });

                //find input element type submit and name submittor

                // const frameset = await page.evaluate(searchTerm => {
                //     let input = document.querySelector("frameset");
                //     return input;
                //     input.value = searchTerm;
                // }, searchTerm);
                
                
            }
            await scrape();
        })()
    // )
})();