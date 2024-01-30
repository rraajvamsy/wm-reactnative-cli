export class CompileArguments{

    compilePreviewArgs(yargs: any){
        return yargs.positional('previewUrl', {
            describe: 'Pereview Url of the React Native app.',
            type: 'string',
            demandOption: true
        }).option('clean', {
            describe: 'If set to true then all existing folders are removed.',
            default: false,
            type: 'boolean',
            demandOption: false
        });
    }

    compileBuildArgs(yargs: any){
        return yargs.positional('src', {
            describe: 'path of rn project',
            default: './',
            type: 'string',
            normalize: true
        })
        .option('dest', {
            alias: 'dest',
            describe: 'dest folder where the react native project will be extracted to',
            type: 'string'
        })
        .option('bt', {
            alias: 'buildType',
            describe: 'development (or) debug (or) production (or) release',
            default: 'debug',
            coerce: (val) => {
                if (val === 'development') {
                    return 'debug';
                }
                if (val === 'production') {
                    return 'release';
                }
                return val;
            },
            choices: ['development', 'debug', 'production', 'release']
        })
    }

    compileThemeArgs(yargs: any){
        return yargs.positional('dest', {
            describe: 'path of React Native Theme',
            default: './',
            type: 'string',
            normalize: true,
            requiresArg: true

        })
    }

    compileEmbedArgs(yargs: any){
        return yargs.positional('src', {
            describe: 'path of React Native project',
            default: './',
            type: 'string',
            normalize: true
        })
        .option('dest', {
            alias: 'dest',
            describe: 'dest folder where the react native project will be extracted to',
            type: 'string'
        })
        .option('modulePath', {
            alias: 'mp',
            describe: 'path to the app module that needs to be embedded.',
            type: 'string',
            requiresArg: true
        });
    }

    compileAndroidArgs(yargs: any){
        return this.compileBuildArgs(yargs).option('appId', {
            alias: 'appId',
            describe: 'unique application identifier',
            type: 'string'
        })
        .option('aks', {
            alias: 'aKeyStore',
            describe: '(Android) path to keystore',
            type: 'string'
        })
        .option('asp', {
            alias: 'aStorePassword',
            describe: '(Android) password to keystore',
            type: 'string'
        })
        .option('aka', {
            alias: 'aKeyAlias',
            describe: '(Android) Alias name',
            type: 'string'
        })
        .option('akp', {
            alias: 'aKeyPassword',
            describe: '(Android) password for key.',
            type: 'string'
        })
        .option('p', {
            alias: 'packageType',
            describe: 'apk (or) bundle',
            default: 'apk',
            choices: ['apk', 'bundle']
        })
        .option('localrnruntimepath', {
            alias: 'localrnruntimepath',
            describe: 'local path pointing to the app-rn-runtime folder',
            type: 'string'
        })
    }

    compileIOSArgs(yargs: any){
        return this.compileBuildArgs(yargs).option('ic', {
            alias: 'iCertificate',
            describe: '(iOS) path of p12 certificate to use',
            type: 'string'
        })
        .option('icp', {
            alias: 'iCertificatePassword',
            describe: '(iOS) password to unlock certificate',
            type: 'string'
        })
        .option('ipf', {
            alias: 'iProvisioningFile',
            describe: '(iOS) path of the provisional profile to use',
            type: 'string'
        });

    }
    
}