import { BuildConfig } from "../config/buildConfig";
import { exec } from '../utils/exec';
const fs = require('fs-extra');
const logger = require('../utils/logger');
import plist from 'plist';


export class IOSUtils{
    buildConfig: BuildConfig;
    constructor(config: BuildConfig){
        this.buildConfig = config;
    }

    async updateInfoPlist(appName, PROVISIONING_UUID) {
        return await new Promise(resolve => {
            try {
            const appId = this.buildConfig.config.metaData.id;
    
            const infoPlistpath = this.buildConfig.config.src + 'ios/build/' + appName +'.xcarchive/Info.plist';
             fs.readFile(infoPlistpath, async function (err, data) {
                const content = data.toString().replace('<key>ApplicationProperties</key>',
                    `<key>compileBitcode</key>
                <true/>
                <key>provisioningProfiles</key>
                <dict>
                    <key>${appId}</key>
                    <string>${PROVISIONING_UUID}</string>
                </dict>
                <key>ApplicationProperties</key>
                `);
                await fs.writeFile(infoPlistpath, Buffer.from(content));
                resolve('success');
            });
        } catch (e: any) {
            resolve('error' + e);
        }
        });
    }

    removePushNotifications(projectDir, projectName){
        const dir = `${projectDir}ios/${projectName}/`;
        const entitlements = dir + fs.readdirSync(dir).find(f => f.endsWith('entitlements'));
        const o = plist.parse(fs.readFileSync(entitlements, 'utf8'));
        delete o['aps-environment'];
        fs.writeFileSync(entitlements, plist.build(o), 'utf8');
        logger.info({
            label: 'remove-push-notification',
            message: `removed aps-environment from entitlements`
        });
    };

    async getUsername() {
        const content = await exec('id', ['-un'], false) as any;
        return content[0];
    }

    async extractUUID() {
        const content = await exec('grep', ['UUID', '-A1', '-a', this.buildConfig.config.iProvisioningFile], {log: false}) as any;
        return content.join('\n').match(/[-A-F0-9]{36}/i)[0];
    }

    async extractTeamId() {
        const content = await exec('grep', ['TeamIdentifier', '-A2', '-a', this.buildConfig.config.iProvisioningFile], {log: false}) as any;
        return content[2].match(/>[A-Z0-9]+/i)[0].substr(1);
    }

    async deleteKeyChain(keychainName) {
        await exec('security', ['delete-keychain', keychainName]);
    }
    

    async importCertToKeyChain(keychainName: string, certificate: string, certificatePassword: string) {
        await exec('security', ['create-keychain', '-p', keychainName, keychainName], {log: false});
        await exec('security', ['unlock-keychain', '-p', keychainName, keychainName], {log: false});
        await exec('security', ['set-keychain-settings', '-t', '3600', keychainName], {log: false});
        let keychains = await exec('security', ['list-keychains', '-d', 'user'], {log: false}) as any;
        keychains = keychains.map(k => k.replace(/[\"\s]+/g, '')).filter(k => k !== '');
        await exec('security', ['list-keychains', '-d', 'user', '-s', keychainName, ...keychains], {log: false});
        await exec('security',
            ['import',
            certificate,
            '-k', keychainName,
            '-P', certificatePassword,
            '-T', '/usr/bin/codesign',
            '-T', '/usr/bin/productsign',
            '-T', '/usr/bin/productbuild',
            '-T', '/Applications/Xcode.app'], {log: false});
        await exec('security', ['set-key-partition-list', '-S', 'apple-tool:,apple:,codesign', '-s', '-k', keychainName, keychainName], {log: false});
        logger.info({
            label: 'import-certKeyChain',
            message: `Cerificate at (${certificate}) imported in (${keychainName})`
        });
        let signingDetails = await exec('security', ['find-identity', '-v', '-p', 'codesigning'], {log: false});
        console.log(signingDetails);
        return async () => {
            keychains = keychains.map(k => k.replace(/[\"\s]+/g, ''));
            await exec('security', ['list-keychains', '-d', 'user', '-s', ...keychains], {log: false});
            await this.deleteKeyChain(keychainName);
            logger.info({
                label: 'import-certKeyChain',
                message: `removed keychain (${keychainName}).`
            });
        };
    }
}