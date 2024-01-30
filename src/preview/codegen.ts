import { Config } from "../config/config";
const fs = require('fs-extra');
const { exec } = require('../utils/exec');
const {logger} = require('../utils/logger');

export class Codegen{
    config: Config;
    constructor(config: Config){
        this.config = config;
    }

    async readAndReplaceFileContent(path: string, writeFn: Function) {
        const content = fs.readFileSync(path, 'utf-8');
        return Promise.resolve().then(() => {    
            return writeFn && writeFn(content);
        }).then((modifiedContent) => {
            if (modifiedContent !== undefined && modifiedContent !== null) {
                fs.writeFileSync(path, modifiedContent);
                return modifiedContent;
            }
            return content;
        });
    }

    async getCodegen(){
        let codegen = process.env.WAVEMAKER_STUDIO_FRONTEND_CODEBASE;
        if (codegen) {
            codegen = `${codegen}/wavemaker-rn-codegen/build/index.js`;
        } else {
            codegen = `${this.config.projectConfig.projectDir}/target/codegen/node_modules/@wavemaker/rn-codegen`;
            if (!fs.existsSync(`${codegen}/index.js`)) {
                const temp = this.config.projectConfig.projectDir + '/target/codegen';
                fs.mkdirSync(temp, {recursive: true});
                await exec('npm', ['init', '-y'], {
                    cwd: temp
                });
                var pom = fs.readFileSync(`${this.config.projectConfig.projectDir}/pom.xml`, { encoding: 'utf-8'});
                var uiVersion = ((pom 
                    && pom.match(/wavemaker.app.runtime.ui.version>(.*)<\/wavemaker.app.runtime.ui.version>/))
                    || [])[1];
                await exec('npm', ['ci', '--save-dev', `@wavemaker/rn-codegen@${uiVersion}`], {
                    cwd: temp
                });
            }
        }
        return codegen;
    }

    async sslPlugin(_config: any){
        if (!(_config.sslPinning && _config.sslPinning.enabled)) {
            await this.readAndReplaceFileContent(`${this.config.projectConfig.expoProjectDir}/App.js`, (content: string) => {
                return content.replace('if (isSslPinningAvailable()) {', 
                    'if (false && isSslPinningAvailable()) {');
            });
        }
    
    }

    async updateConfig(){
        const configJSONFile = `${this.config.projectConfig.wmProjectDir}/wm_rn_config.json`;
        const config = fs.readJSONSync(configJSONFile);
        config.serverPath = `${this.config.previewConfig.proxyUrl}/`;
        fs.writeFileSync(configJSONFile, JSON.stringify(config, null, 4));
        return config
    }

    async transpileProfile(codegen: string){
        const profile = this.config.previewConfig.isEsBuild ? 'web-preview' : 'expo-preview';
        await exec('node',
            [codegen, 'transpile', '--profile="' + profile + '"', '--autoClean=false',
            this.config.projectConfig.wmProjectDir, this.config.projectConfig.expoProjectDir]);
    }
    
    async transpile() {
        const codegen = await this.getCodegen();
        const config = await this.updateConfig();
        await this.transpileProfile(codegen);
        await this.sslPlugin(config);
        logger.info({
            label: "transpile",
            message: `generated expo project at ${this.config.projectConfig.expoProjectDir}`
        });
    }
}