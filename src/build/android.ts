import { BuildConfig } from "../config/buildConfig";
import fs from 'fs-extra';
import { logger } from "../utils/logger";
import { exec } from '../utils/exec';
import { ReleaseUtils } from "./androidRealeaseUtils";

export class Android{
    buildConfig: BuildConfig;
    releaseUtils: ReleaseUtils;
    constructor(config: BuildConfig){
        this.buildConfig = config;
        this.releaseUtils = new ReleaseUtils(this.buildConfig);
    }

    async executeAndroid(){
        if(this.buildConfig.config.buildType == 'release'){
            await this.execReleaseBuild();
        }
        else{
            await this.execDebugBuild();
        }
    }
    
    updateJSEnginePreference() {
        const jsEngine = require(this.buildConfig.config.src + 'app.json').expo.jsEngine;
        const gradlePropsPath = this.buildConfig.config.src + 'android/gradle.properties';
        if (fs.existsSync(gradlePropsPath)) {
            let data = fs.readFileSync(gradlePropsPath, 'utf8');
            data = data.replace(/expo\.jsEngine=(jsc|hermes)/, `expo.jsEngine=${jsEngine}`)
            fs.writeFileSync(gradlePropsPath, data);
            logger.info({
                label: 'update-jsEngine-preferences',
                message: `js engine is set as ${jsEngine}`
            });
        }
    }

    updateSettingsGradleFile(appName: string) {
        const path = this.buildConfig.config.src + 'android/settings.gradle';
        let content = fs.readFileSync(path, 'utf8');
        if (content.search(/^rootProject.name = \'\'/gm) > -1) {
            content = content.replace(/^rootProject.name = \'\'/gm, `rootProject.name = ${appName}`);
            fs.writeFileSync(path, content);
        }
    }

    async bundle(){
        const output = this.buildConfig.config.dest + 'output/android/';
        const outputFilePath = `${output}${this.buildConfig.config.metaData.name}(${this.buildConfig.config.metaData.version}).debug.${this.buildConfig.config.packageType === 'bundle' ? 'aab': 'apk'}`;
    
        let bundlePath = '';
        let folder = this.buildConfig.config.buildType === 'release' ? 'release' : 'debug';
        if (this.buildConfig.config.packageType === 'bundle') {
            bundlePath = this.buildConfig.buildUtils.findFile(`${this.buildConfig.config.dest}android/app/build/outputs/bundle/${folder}`, /\.aab?/);
        } else {
            bundlePath = this.buildConfig.buildUtils.findFile(`${this.buildConfig.config.dest}android/app/build/outputs/apk/${folder}`, /\.apk?/);
        }
        fs.mkdirSync(output, {recursive: true});
        fs.copyFileSync(bundlePath, outputFilePath);
        return {
            success: true,
            output: outputFilePath
        };
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

    async execReleaseBuild(){
        this.releaseUtils.addProguardRule();
        this.releaseUtils.updateOptimizationFlags();
        this.updateAndroidBuildGradleFile('release');
        await this.releaseUtils.generateSignedApk();
        logger.info({
            label: 'android-build',
            message: 'build completed'
        });
        return await this.bundle();
    }

    async execDebugBuild(){
        await this.invokeAndroid();
        this.buildConfig.buildUtils.updateAndroidBuildGradleFile('debug');
        try {
            await exec('./gradlew', ['assembleDebug'], {
                cwd: this.buildConfig.config.src + 'android'
            });
        } 
        catch(e) {
            console.error('error generating release apk. ', e);
            return {
                success: false,
                errors: e
            }
        }
        logger.info({
            label: 'android-build',
            message: 'build completed'
        });
        return await this.bundle();
    }

    async invokeAndroid(){
        this.updateJSEnginePreference();
        this.updateSettingsGradleFile(this.buildConfig.config.metaData.name);
    }

}