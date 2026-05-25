const pdf = require('pdf-parse');
console.log('Type of pdf:', typeof pdf);
console.log('Is pdf a function?', typeof pdf === 'function');
console.log('pdf export keys:', Object.keys(pdf));
if (pdf.default) {
    console.log('pdf.default type:', typeof pdf.default);
}
