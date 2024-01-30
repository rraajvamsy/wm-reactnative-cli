import { Availability } from "./availability";
import fs from 'fs-extra';
import semver from 'semver';
import prompt from 'prompt';
import { logger } from './../utils/logger';
import { exec } from './../utils/exec';


const loggerLabel = 'rn-cli-requirements';

export class Validations{
    availability: Availability;
    constructor(){
        this.availability = new Availability();
        
    }
    async hasValidJavaVersion() {
        const javaVersion = (await exec('java', ['-version']) as any).join('').match(/[0-9\.]+/)[0];
    
        if (semver.lt(semver.coerce(javaVersion).version, this.availability.versions.JAVA)) {
            logger.error('Minimum java version required is' + this.availability.versions.JAVA + '. Please update the java version.');
            return false;
        }
    
        const envVariable = process.env['JAVA_HOME'];
    
        if (!envVariable) {
            logger.error({
                'label': loggerLabel,
                'message': 'Failed to find \'JAVA_HOME\' environment variable. Try setting it manually.\n' +
                'Try update your \'PATH\' to include path to valid directory.'});
            return false;
        }
        return true;
    }
    
    async isGitInstalled() {
        return await this.availability.checkAvailability('git');
    }
    
    async hasYarnPackage() {
        return await this.availability.checkAvailability('yarn');
    }
    
    async  isCocoaPodsInstalled() {
        return await this.availability.checkAvailability('pod');
    }
    
    async  hasValidNodeVersion() {
        return await this.availability.checkAvailability('node');
    }
    
    async hasValidExpoVersion() {
        return await this.availability.checkAvailability('expo');
    }
    
    validateForAndroid(keyStore, storePassword, keyAlias, keyPassword) {
        let errors: string[] = [];
        if (!(keyStore && fs.existsSync(keyStore))) {
            errors.push(`keystore is required (valid file): ${keyStore}`);
        }
        if (!keyAlias) {
            errors.push('keyAlias is required.');
        }
        if (!keyPassword) {
            errors.push('keyPassword is required.');
        }
        if (!storePassword) {
            errors.push('storePassword is required.');
        }
        return errors;
    }
    
    validateForIos(certificate, password, provisionalFilePath, buildType) {
        let errors: string[] = [];
        if (!(certificate && fs.existsSync(certificate))) {
            errors.push(`p12 certificate does not exists : ${certificate}`);
        }
        if (!password) {
            errors.push('password to unlock certificate is required.');
        }
        if (!(provisionalFilePath && fs.existsSync(provisionalFilePath))) {
            errors.push(`Provisional file does not exists : ${provisionalFilePath}`);
        }
        if (!buildType) {
            errors.push('Package type is required.');
        }
        return errors;
    }
    
    async showConfirmation(message) {
        return new Promise((resolve, reject) => {
            prompt.get({
                properties: {
                    confirm: {
                        pattern: /^(yes|no|y|n)$/gi,
                        description: message,
                        message: 'Type yes/no',
                        required: true,
                        default: 'no'
                    }
                }
            }, function (err, result) {
                if (err) {
                    reject();
                }
                resolve(result.confirm.toLowerCase());
            });
        });
    }
    
    async canDoEmbed() {
        let flag = true;
        flag = flag && await this.hasValidNodeVersion();
        flag = flag && await this.hasYarnPackage();
        flag = flag && await this.isGitInstalled();
        flag = flag && await this.hasValidExpoVersion();
        return flag;
    }
    
    async canDoIosBuild() {
        let flag = true;
        flag = flag && await this.hasValidNodeVersion();
        flag = flag && await this.hasYarnPackage();
        flag = flag && await this.isGitInstalled();
        flag = flag && await this.hasValidExpoVersion();
        flag = flag && await this.isCocoaPodsInstalled();
        return flag;
    }
    
    async canDoAndroidBuild() {
        let flag = true;
        flag = flag && !!await this.hasValidNodeVersion();
        flag = flag && !!await this.hasYarnPackage();
        flag = flag && !!await this.isGitInstalled();
        flag = flag && !!await this.hasValidExpoVersion();
        flag = flag && !!await this.hasValidJavaVersion();
        flag = flag && !!await this.availability.checkForGradleAvailability();
        return flag;
    }
    
}