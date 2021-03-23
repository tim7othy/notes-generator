const marked = require("marked");
const fs = require('fs');

fs.readFile('./test.md', 'utf8', (err, content) => {
    if (err) {
        console.log(err);
        return;
    }
    const html = marked(content);
    const generated = `
        <!doctype html>
        <html>
        <head>
        <meta charset="utf-8"/>
        <title>Marked in the browser</title>
        </head>
        <body>
        <div id="content">${html}</div>
        </body>
        </html>
    `
    fs.writeFile('./index.html', generated, 'utf8', (err) => {
        if (err) {
            console.log(err);
            return;
        }
        console.log("写入成功！");
    })

});
