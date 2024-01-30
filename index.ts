import yargs, { Argv } from 'yargs';
import { CompileArguments } from './compileArguments';
import { Config } from './src/config/config';
import { PreviewCommands } from './src/preview/previewCommands';
import { BuildConfig } from './src/config/buildConfig';
import { BuildCommands } from './src/build/buildCommands';
import { Embed } from './src/embed/embed';
import { exec } from './src/utils/exec'


const compile = new CompileArguments();

function executeRunCommand(args: any) {
    const config = new Config(args);    
    const previewCommands = new PreviewCommands(config);
    previewCommands.initialize();
}

async function executeBuildCommand(args: any) {
    const config = new BuildConfig();
    await config.initialize_config(args);
    const BuildCommand = new BuildCommands(config);
    BuildCommand.build();
}

async function executeEmbedCommand(args: any){
    const config = new BuildConfig();
    await config.initialize_config(args);
    const buildCommand = new BuildCommands(config);
    await buildCommand.build();
    const embed = new Embed(config);
    if(args._.includes('android')){
        await embed.androidEmbed();
    }
    else{
        await embed.iosEmbed();
    }
}

async function executeThemeCommand(args: any){
    if(args._.includes('generate')){
        await exec('wm-rn-codegen', ['theme', 'generate', args.dest]);
    }
    else if(args._.includes('compile')){
        await exec('wm-rn-codegen', ['theme', 'compile'], {cwd:args.dest});
    }
    else{
        await exec('wm-rn-codegen', ['theme', 'update'], {cwd:args.dest});
    }
}


const args = yargs
    .command('run', '', (yargs: any) => {
        yargs
        .command('expo <previewurl> [clean]', 'uses expo cli to preview the App and shows the barcode', (yargs: any) => compile.compilePreviewArgs(yargs), (args: any) => executeRunCommand(args))
        .command('expo-web <previewurl> [clean]', 'uses expo web API to preview the App', (yargs: any) => compile.compilePreviewArgs(yargs), (args: any) => executeRunCommand(args))
        .command('android <previewurl> [clean]', 'ejects the expo project and shows Android preview in the emulator by using react native cli', (yargs: any) => compile.compilePreviewArgs(yargs), (args: any) => executeRunCommand(args))
        .command('ios <previewurl> [clean]', 'ejects the expo project and shows IOS preview in the emulator by using react native cli', (yargs: any) => compile.compilePreviewArgs(yargs), (args: any) => executeRunCommand(args))
        .command('esbuild <previewurl> [clean]', 'uses esbuild for the web preview', (yargs: any) => compile.compilePreviewArgs(yargs), (args: any) => executeRunCommand(args))
        .demandCommand()
    })
    .command('build', '', (yargs: any) => {
        yargs
        .command('android <src> [options]', 'build android', (yargs: any) => compile.compileAndroidArgs(yargs), (args: any) => executeBuildCommand(args))
        .command('ios <src> [options]', 'build ios', (yargs: any) => compile.compileIOSArgs(yargs), (args: any) => executeBuildCommand(args))
        .demandCommand()
    })
    // .command('theme', '', (yargs: any) => {
    //     yargs
    //     .command('generate <dest>', 'generate Theme', (yargs: any) => compile.compileThemeArgs(yargs), (args: any) => executeThemeCommand(args))
    //     .command('compile <dest>', 'compile Theme', (yargs: any) => compile.compileThemeArgs(yargs), (args: any) => executeThemeCommand(args))
    //     .command('update <dest>', 'update Theme', (yargs: any) => compile.compileThemeArgs(yargs), (args: any) => executeThemeCommand(args))
    //     .demandCommand()
    // })
    .command('embed', '', (yargs: any) => {
        yargs
        .command('android <src> [options]', 'Embed React Native project with Native Android project', (yargs: any) => compile.compileEmbedArgs(yargs), (args: any) => executeEmbedCommand(args))
        .command('ios <src> [options]', 'Embed React Native project with Native iOS project.', (yargs: any) => compile.compileEmbedArgs(yargs), (args: any) => executeEmbedCommand(args))
    })
    .command('sync <previewurl> [clean]', 'downloads the expo project from the preview url ', (yargs: any) => compile.compilePreviewArgs(yargs) , async (args: any) => executeRunCommand(args))
    .demandCommand()
    .help('h')
    .alias('h', 'help').wrap(150).argv;

