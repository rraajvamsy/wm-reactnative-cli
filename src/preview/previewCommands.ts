import { Config } from "../config/config";
import { PreviewUtils } from "./previewUtils";
import { LaunchServices } from "./launchServices";
import { Watcher } from './watcher'
import fs from 'fs-extra';
import { exec } from '../utils/exec';

export class PreviewCommands{
    watcher: any;
    launch: any;
    config: Config;
    constructor(config: Config){
        this.config = config;
    }

    async initialize(){
        if (this.config.previewConfig.clean) {
            this.config.localstorage.clear();
        }
        const utils = new PreviewUtils(this.config);
        await utils.setup();
        await (this.config.previewConfig.isEsBuild? utils.installExpoWebDependencies() : utils.installDependencies());
        this.launch = new LaunchServices(this.config);
        this.watcher = new Watcher(this.config);
        this.config.previewConfig.isWebExpo?this.launch.launchWebServiceProxy():this.launch.launchServiceProxy();
        if (typeof this[this,this.config.command] === 'function') {
            await this[this,this.config.command]();
        }
    }

    async esbuild(){
        await this.watcher.syncWeb();
        await this.launch.launchExpo();
    }

    async expo(){
        const barcodePort = this.config.projectConfig.latestVersion ? 19000 : 8081;
        await this.watcher.sync();
        this.launch.launchToolServer(barcodePort);
        await this.launch.launchExpo();
    }
    
    async expoWeb(){
        await this.watcher.syncWeb();
        await this.launch.launchExpo();
    }
    
    async native(){
        await exec('npx', ['expo','prebuild'], {
            cwd: this.config.projectConfig.expoProjectDir
        });
        await this.watcher.sync();
        await this.launch.launchNative();
    }
}