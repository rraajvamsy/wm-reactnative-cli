const execa = require('execa');
async function compile() {
    await execa(`./node_modules/.bin/tsc`, ['--project', `tsconfig.json`]);
}

module.exports = {
    compile: compile
}
