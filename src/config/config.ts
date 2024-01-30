import { Argv } from 'yargs';
import { ProjectConfiguration, PreviewConfiguration } from './configTypes'
import { LocalStorage } from "node-localstorage";
import os from "os";
import fs from 'fs-extra';
import path from 'path';

export class Config{
    projectConfig!: ProjectConfiguration;
    previewConfig!: PreviewConfiguration;
    static instance: Config;
    localstorage: any;
    STORE_KEY: string = 'user.auth.token';
    command!: string;
    rootDir!: string;
    constructor(args: Argv){
        if(!Config.instance){
            this.initialize_config(args);
            Config.instance = this;
        }
    }

    initialize_config(args: any){
        this.rootDir = process.env.WM_REACTNATIVE_CLI || `${os.homedir()}/.wm-reactnative-cli`
        this.localstorage = new LocalStorage(`${this.rootDir}/.store`)
        this.command = args._.includes('sync') ? 'sync' : args._.includes('android') || args._.includes('ios') ? 'native' : args._.includes('expo-web') ? 'expoWeb' : args._.includes('expo') ? 'expo' : 'esbuild'   
        this.projectConfig = {
            baseUrl: new URL(args.previewurl).origin,
            authCookie: this.localstorage.getItem(this.STORE_KEY) || '',
            projectId: '',
            projectName: '',
            expoProjectDir: '',
            latestVersion: true,
            platformVersion: '',
            wmProjectDir: '',
            projectDir: '',
            syncProject: ()=>{}
        }
        this.previewConfig = {
            proxyUrl: `http://${this.getIpAddress()}:19009`,
            expoUrl: `exp://${this.getIpAddress()}:`,
            proxyPort: 19009,
            previewUrl: args.previewurl,
            clean: args.clean,
            isEsBuild: args._.includes('esbuild'),
            isWebExpo: args._.includes('expo-web'),
            nativeType: (args._.includes('run') && args._.includes('android'))? 'android': (args._.includes('run') && args._.includes('ios')) ? 'ios' : ''
        };

    }

    getIpAddress() {
        var interfaces = os.networkInterfaces();
        for(var key in interfaces) {
            var addresses = interfaces[key];
            for(var i = 0; i < addresses!.length; i++) {
                var address = addresses![i];
                if(!address.internal && address.family === 'IPv4') {
                    return address.address;
                };
            };
        };
        return 'localhost';
    }

    copyContentsRecursiveSync(src: string, dest: string) {
        const _this = this;
        fs.readdirSync(src).forEach(function(file: any){
            var childSrc = path.join(src, file);
            var childDest = path.join(dest, file);
            var exists = fs.existsSync(childSrc);
            var stats = exists && fs.statSync(childSrc);
            var isDirectory = exists && stats.isDirectory();
            if (isDirectory) {
                if (!fs.existsSync(childDest)) {
                    fs.mkdirSync(childDest);
                }
                _this.copyContentsRecursiveSync(childSrc, childDest);
            } else {
          fs.copyFileSync(childSrc, childDest);
            }
        });
    };

    isWindowsOS() {
        return (os.platform() === "win32");
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
    
    async iterateFiles(path: string, callBack: Function) {
        if (fs.lstatSync(path).isDirectory()) {
            await Promise.all(fs.readdirSync(path).map((p) => this.iterateFiles(`${path}/${p}`, callBack)));
        } else {
            await callBack && callBack(path);
        }
    }
    
}