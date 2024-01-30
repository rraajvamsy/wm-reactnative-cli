import { BuildConfig } from "../config/buildConfig";
import { logger } from '../utils/logger';
import fs from 'fs-extra';
import path from 'path';
import { Android } from "./android";
import { exec } from '../utils/exec';
import { IOS } from "./ios";


export class BuildCommands{
    buildConfig: BuildConfig;
    android: Android;
    ios: IOS;
    constructor(config: BuildConfig){
        this.buildConfig = config;
        this.android = new Android(this.buildConfig);
        this.ios = new IOS(this.buildConfig);
    }

    async setupBuildDirectory() {
        let src = await this.buildConfig.buildUtils.extractRNZip();
        let dest = this.buildConfig.config.dest;
        const metadata = await this.buildConfig.buildUtils.readWmRNConfig();
        if (fs.existsSync(dest)) {
            if (fs.readdirSync(dest).length) {
                const response = await this.buildConfig.validations.showConfirmation('Would you like to empty the dest folder (i.e. ' + dest + ') (yes/no) ?');
                if (response !== 'y' && response !== 'yes') {
                    logger.error({
                        label: 'setup-build-directory',
                        message: 'Non empty folder cannot be used as desination. Please choose a different destination and build again.'
                    });
                    return;
                }
                // using removeSync when dest is directory and unlinkSync works when dest is file.
                const fsStat = fs.lstatSync(dest);
                if (fsStat.isDirectory()) {
                    fs.removeSync(dest);
                } else if (fsStat.isFile()) {
                    fs.unlinkSync(dest);
                }
            }
        }
        dest = dest || await this.buildConfig.buildUtils.getDefaultDestination();
        dest = path.resolve(dest)  + '/';
        if(src === dest) {
            logger.error({
                label: 'setup-build-directory',
                message: 'source and destination folders are same. Please choose a different destination.'
            });
            return;
        }
        fs.mkdirsSync(dest);
        fs.copySync(src, dest);
        const logDirectory = dest + 'output/logs/';
        fs.mkdirSync(logDirectory, {
            recursive: true
        });
        logger.setLogDirectory(logDirectory);
        return {
            src: src,
            dest: dest
        };
    }

    async build(){
        const directories = await this.setupBuildDirectory();
        this.buildConfig.config.src = directories?.src;
        this.buildConfig.config.dest = directories?.dest;
        // TODO: iOS app showing blank screen
        if (!(this.buildConfig.config.metaData.sslPinning && this.buildConfig.config.metaData.sslPinning.enabled)) {
            await this.buildConfig.readAndReplaceFileContent(`${this.buildConfig.config.src}/App.js`, content => {
                return content.replace('if (isSslPinningAvailable()) {', 
                    'if (false && isSslPinningAvailable()) {');
            });
        }
        await this.ejectProject();
        let outputDirectory = this.buildConfig.config.src + 'output/';
        this.buildConfig.config.logDirectory = outputDirectory + 'logs/';
        logger.info({
            label: 'build',
            message: `Building at : ${this.buildConfig.config.src}`
        });
        try {
            let result;
            // await clearUnusedAssets(config.platform);
            if (this.buildConfig.config.platform === 'android') {
                result = await this.android.executeAndroid();
            } else if (this.buildConfig.config.platform === 'ios') {
                await exec('pod', ['install'], {
                    cwd: this.buildConfig.config.src + 'ios'
                });
                result = await this.ios.invokeiosBuild();
            }
            console.log(result)
            if (result.errors && result.errors.length) {
                logger.error({
                    label: 'android-build',
                    message: this.buildConfig.config.platform + ' build failed due to: \n\t' + result.errors.join('\n\t')
                });
            } else if (!result.success) {
                logger.error({
                    label: 'android-build',
                    message: this.buildConfig.config.platform + ' BUILD FAILED'
                });
            } else {
                logger.info({
                    label: 'android-build',
                    message: `${this.buildConfig.config.platform} BUILD SUCCEEDED. check the file at : ${result.output}.`
                });
                logger.info({
                    label: 'android-build',
                    message: `File size : ${Math.round(this.buildConfig.buildUtils.getFileSize(result.output) * 100 / (1024 * 1024)) / 100} MB.`
                });
            }
            return result;
        } catch(e) {
            logger.error({
                label: 'android-build',
                message: 'BUILD Failed. Due to :' + e
            });
            return {
                success : false,
                errors: e
             };
        }
       
    }

    async ejectProject() {
        try {
            logger.info({
                label: 'eject-project',
                message: 'destination folder where app is build at ' + this.buildConfig.config.dest
            })    
            await exec('yarn', ['install'], {
                cwd: this.buildConfig.config.src
            });
            await exec('npx', ['expo','prebuild'], {
                cwd: this.buildConfig.config.src
            });
            logger.info({
                'label': 'eject',
                'message': 'expo eject succeeded'
            });
            if (this.buildConfig.config.localrnruntimepath) {
                const linkFolderPath = this.buildConfig.config.src + 'node_modules/@wavemaker/app-rn-runtime';
                // using removeSync when target is directory and unlinkSync works when target is file.
                if (fs.existsSync(linkFolderPath)) {
                    fs.removeSync(linkFolderPath);
                }
                await fs.mkdirsSync(linkFolderPath);
                await fs.copySync(this.buildConfig.config.localrnruntimepath, linkFolderPath);
                logger.info({
                    'label': 'eject',
                    'message': 'copied the app-rn-runtime folder'
                })
            }
        } catch (e) {
            logger.error({
                label: 'eject',
                message: this.buildConfig.config.platform + ' eject project Failed. Due to :' + e
            });
            return { errors: e, success : false };
        }
    }
}