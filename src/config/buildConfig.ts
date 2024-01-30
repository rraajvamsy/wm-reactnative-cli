import { BuildAndroidConfiguration, BuildAndroidDebugConfiguration, BuildIOSConfiguration } from './configTypes'
import { Config } from './config';
import { Validations } from './../utils/validation';
import { BuildUtils } from '../build/buildUtils';
import fs from 'fs-extra';
import { exec } from '../utils/exec';

export class BuildConfig{ 
    static instance: BuildConfig;
    config!: any;
    STORE_KEY: string = 'user.auth.token';
    validations: Validations;
    buildUtils!: BuildUtils;
    constructor(){
        this.validations = new Validations();
        this.config = {};
        this.buildUtils = new BuildUtils(this);
        if(!Config.instance){
            BuildConfig.instance = this;
        }
    }

    async initialize_config(args: any){
        const prerequisiteError = {
            errors: 'check if all prerequisites are installed.',
            success: false
        };
        if(args._.includes('aKeyStore')){
            if (!await this.validations.availability.checkForAndroidStudioAvailability()) {
                return {
                    success: false
                }
            }
            if (!await this.validations.canDoAndroidBuild()) {
                return prerequisiteError;
            }
            this.config = {
                src: args.src,
                dest: args.dest,
                platform: 'android',
                aKeyStore: args.aKeyStore,
                aStorePassword: args.aStorePassword,
                aKeyAlias: args.aKeyAlias,
                aKeyPassword: args.aKeyPassword,
                buildType: 'release',
                modulePath: args.modulePath,
                localrnruntimepath: args.localrnruntimepath
            } as BuildAndroidConfiguration
            const errors = this.validations.validateForAndroid(args.aKeyStore, args.aStorePassword, args.keyAlias, args.keyPassword);
            if (errors.length > 0) {
                return {
                    success: false,
                    errors: errors
                }
            }
        }
        else if(args._.includes('iCertificate')){
            const errors = this.validations.validateForIos(args.certificate, args.certificatePassword, args.provisionalFile, args.buildType);
            if (errors.length > 0) {
                return {
                    success: false,
                    errors: errors
                }
            }
            if (!await this.validations.canDoIosBuild()) {
                return prerequisiteError;
            }
            this.config = {
                src: args.src,
                iCertificate: args.iCertificate,
                platform: 'ios',
                iCertificatePassword: args.iCertificatePassword,
                iProvisioningFile: args.iProvisioningFile,
                iCodeSigningIdentity: args.iCodeSigningIdentity,
                buildType: 'release',
                modulePath: args.modulePath,
                localrnruntimepath: args.localrnruntimepath
            } as BuildIOSConfiguration
        }
        else{
            if (!await this.validations.availability.checkForAndroidStudioAvailability()) {
                return {
                    success: false
                }
            }
            if (!await this.validations.canDoAndroidBuild()) {
                return prerequisiteError;
            }
            this.config = {
                src: args.src,
                buildType: 'debug',
                platform: 'android',
                modulePath: args.modulePath,
                localrnruntimepath: args.localrnruntimepath
            } as BuildAndroidDebugConfiguration
        }
        this.buildUtils = new BuildUtils(this);
        this.config.metaData =  await this.buildUtils.readWmRNConfig()
        if (this.config.metaData.icon.src.startsWith('resources')) {
            this.config.metaData.icon.src = 'assets/' + this.config.metaData.icon.src;
         }
         if (this.config.metaData.splash.src.startsWith('resources')) {
            this.config.metaData.splash.src = 'assets/' + this.config.metaData.splash.src;
         }
    
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

    async createJSBundle() {
        fs.mkdirpSync(this.config.src + '/android/app/src/main/assets');
        return await exec('npx', ['react-native', 'bundle', '--platform',  'android',
                '--dev', 'false', '--entry-file', 'index.js',
                '--bundle-output', 'android/app/src/main/assets/index.android.bundle',
                '--assets-dest', 'android/app/src/main/res/'], {
            cwd: this.config.src
        });
    }

}