import { BuildConfig } from "../config/buildConfig";
import { logger } from '../utils/logger';
import os from "os";
import fs from 'fs-extra';
import path, { resolve } from 'path';
import { unzip } from '../utils/zip';

export class BuildUtils{
    buildConfig: BuildConfig;
    constructor(config: BuildConfig){
        this.buildConfig = config;
    }

    endWith(str: string, suffix: string){
        if (!str.endsWith(suffix)) {
            return str += suffix;
        }
        return str;
    };
    
    findFile(path: string, nameregex: RegExp) {
        const files = fs.readdirSync(path);
        const f = files.find(f => f.match(nameregex));
        return this.endWith(path, '/') + f;
    }
    
    isWindowsOS() {
        return (os.platform() === "win32");
    }
    
    getFileSize(path: string) {
        const stats = path && fs.statSync(path);
        return (stats && stats['size']) || 0;
    }
    
    async extractRNZip()  {
        let src = this.buildConfig.config.src;
        let folderName = this.isWindowsOS() ? src.split('\\').pop() : src.split('/').pop();
        const isZipFile = folderName?.endsWith('.zip');
    
        folderName = isZipFile ? folderName?.replace('.zip', '') : folderName;
    
        const tmp = `${require('os').homedir()}/.wm-reactnative-cli/temp/${folderName}/${Date.now()}`;
    
        if (src.endsWith('.zip')) {
            const zipFile = src;
            src = tmp + '/src';
    
            if (!fs.existsSync(src)) {
                fs.mkdirsSync(src);
            }
            await unzip(zipFile, src);
        }
        return path.resolve(src) + '/';
    }
        
    async getDefaultDestination() {
        const version = '1.0.0';
        const path = `${os.homedir()}/.wm-reactnative-cli/build/${this.buildConfig.config.metaData.id}/${version}/${this.buildConfig.config.platform}`;
        fs.mkdirSync(path, {
            recursive: true
        });
        let next = 1;
        if (fs.existsSync(path)) {
            next = fs.readdirSync(path).reduce((a, f) => {
                try {
                    const c = parseInt(f);
                    if (a <= c) {
                        return c + 1;
                    }
                } catch(e) {
                    //not a number
                }
                return a;
            }, next);
        }
        const dest = path + '/' + next;
        fs.mkdirSync(dest, {
            recursive: true
        });
        return dest;
    }

    async readWmRNConfig() {
        let src = path.resolve(this.buildConfig.config.src) + '/';
        let jsonPath = src + 'wm_rn_config.json';
        let data = await fs.readFileSync(jsonPath);
        data = JSON.parse(data);
        data.preferences = data.preferences || {};
        data.preferences.enableHermes = true;
        return data;
    }

    async writeWmRNConfig(content: any) {
        let src = path.resolve(this.buildConfig.config.src) + '/';
        let jsonPath = src + 'wm_rn_config.json';
        let data = await fs.readFileSync(jsonPath);
        data = JSON.parse(data);
        if (content) {
            Object.assign(data, content);
        }
        await fs.writeFile(jsonPath, JSON.stringify(data), error => {
            if (error) {
                throw error;
            }
            logger.info({
                'label': 'write-rn-config',
                'message': 'updated wm_rn_config.json file'
            })
        })
    }

    async updateAndroidBuildGradleFile(type: string) {
        const buildGradlePath = this.buildConfig.config.src + 'android/app/build.gradle';
        if (fs.existsSync(buildGradlePath)) {
            let content = fs.readFileSync(buildGradlePath, 'utf8');
            if (type === 'release') {
                if (content.search(`entryFile: "index.js"`) === -1) {
                    content = content.replace(/^(?!\s)project\.ext\.react = \[/gm, `project.ext.react = [
            entryFile: "index.js",
            bundleAssetName: "index.android.bundle",
            bundleInRelease: true,`);
                } else {
                    content = content.replace(/bundleInDebug\: true/gm, `bundleInDebug: false,
            bundleInRelease: true,`).replace(/devDisabledInDebug\: true/gm, ``)
                        .replace(/bundleInRelease\: false/gm, `bundleInRelease: true`);
                }
            } else {
                if (content.search(`entryFile: "index.js"`) === -1 && content.search('project.ext.react =') >= 0) {
                    content = content.replace(/^(?!\s)project\.ext\.react = \[/gm, `project.ext.react = [
            entryFile: "index.js",
            bundleAssetName: "index.android.bundle",
            bundleInDebug: true,
            devDisabledInDebug: true,`);
                } else if (content.indexOf(`bundleInDebug:`) >= 0) {
                    content = content.replace(/bundleInDebug\: false/gm, `bundleInDebug: true`)
                        .replace(/devDisabledInDebug\: false/gm, `devDisabledInDebug: true`)
                        .replace(/bundleInRelease\: true/gm, `bundleInRelease: false`);
                } else {
                    await this.buildConfig.createJSBundle();
                }
            }
            fs.writeFileSync(buildGradlePath, content);
        }
    }

}