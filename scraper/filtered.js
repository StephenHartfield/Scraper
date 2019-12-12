const companiesList = require("./LargeFLOutput.json");
const fs = require("fs");

// let finalResult = companiesList.reduce(function (a, b) { return a.concat(b); })

function filterCompanies(val) {
    if (val.firstName && val.lastName) {
        if (val.firstName.indexOf('THE') == -1 
            && val.firstName.indexOf('LLC') == - 1 && val.lastName.indexOf('LLC') == - 1 
            && val.firstName.indexOf('INC') == - 1 && val.lastName.indexOf('INC') == - 1
            && val.firstName.indexOf('LLP') == - 1 && val.lastName.indexOf('LLP') == - 1) {
            return true;
        } else {
            return false;
        }
    }
}

function filterOnEach(val) {
    val = val.filter(individual => filterCompanies(individual))
    if (val.length == 0) {
        return '';
    } else {
        return val;
    }
}

finalResult = companiesList.map(val => filterOnEach(val));
finalResult = finalResult.filter(val => val != '');
finalResult = finalResult.map(val => val.map(individual => {
    if(individual.status) {
        return ({
            ...individual,
            status: individual.status.replace(/Title/g, '').trimLeft()
        });
    }
}));

let finalJson = JSON.stringify(finalResult);
fs.writeFileSync(`./FL_filtered_final.json`, finalJson, "utf-8");


