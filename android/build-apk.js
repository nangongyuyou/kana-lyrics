// Build the Android app without Gradle: aapt2 -> javac -> d8 -> zipalign -> apksigner.
// Usage: node build-apk.js <page.html> <out.apk>
// Tools (env overrides): JDK_BIN = JDK 17 bin folder, ANDROID_SDK = SDK with build-tools 34.0.0 and
// platforms/android-34, SEVENZ = 7-Zip command line exe. Defaults are the folders next to this script.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const T = __dirname;
const JDK = process.env.JDK_BIN || path.join(T, 'jdk-17.0.20.1+1', 'bin');
const SDK = process.env.ANDROID_SDK || path.join(T, 'sdk');
const BT = path.join(SDK, 'build-tools', '34.0.0');
const JAR = path.join(SDK, 'platforms', 'android-34', 'android.jar');
// the app project: an "app" folder next to this script, or this folder itself (as in the repository)
const APP = fs.existsSync(path.join(T, 'app', 'AndroidManifest.xml')) ? path.join(T, 'app') : T;
const B = path.join(T, 'build');
const LOCAL7Z = 'E:\\ruanjian\\五十音学习工具\\VOICEVOX\\7za.exe';
const SEVENZ = process.env.SEVENZ || (fs.existsSync(LOCAL7Z) ? LOCAL7Z : '7za');
const KS = process.env.KANA_KS || path.join(T, 'kana-release.keystore');
// keystore password: KANA_KS_PASS, or one line in kana-release.pass next to the keystore (never committed)
const PASSFILE = path.join(T, 'kana-release.pass');
const KSPASS = process.env.KANA_KS_PASS || (fs.existsSync(PASSFILE) && fs.readFileSync(PASSFILE, 'utf8').trim());
if (!KSPASS) throw new Error('set KANA_KS_PASS (a new keystore is created with it if none exists)');
const [, , PAGE, OUT] = process.argv;

const run = (exe, args, opts = {}) => {
  console.log('>', path.basename(exe), args.slice(0, 4).join(' '), args.length > 4 ? '…' : '');
  execFileSync(exe, args, { stdio: 'inherit', ...opts });
};
const bat = name => path.join(BT, name + '.bat');

fs.rmSync(B, { recursive: true, force: true });
fs.mkdirSync(path.join(B, 'gen'), { recursive: true });
fs.mkdirSync(path.join(B, 'classes'), { recursive: true });
fs.mkdirSync(path.join(APP, 'assets'), { recursive: true });
fs.copyFileSync(PAGE, path.join(APP, 'assets', 'index.html'));

// 1. resources + manifest + assets
run(path.join(BT, 'aapt2.exe'), ['compile', '--dir', path.join(APP, 'res'), '-o', path.join(B, 'res.zip')]);
run(path.join(BT, 'aapt2.exe'), ['link', '-I', JAR, '--manifest', path.join(APP, 'AndroidManifest.xml'),
  '-A', path.join(APP, 'assets'), '--java', path.join(B, 'gen'), '-o', path.join(B, 'base.apk'), path.join(B, 'res.zip')]);

// 2. java -> class
const sources = [];
const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.java') && sources.push(path.join(d, e.name)));
walk(path.join(APP, 'src')); walk(path.join(B, 'gen'));
run(path.join(JDK, 'javac.exe'), ['-encoding', 'UTF-8', '-source', '1.8', '-target', '1.8', '-nowarn', '-Xlint:-options',
  '-bootclasspath', JAR, '-d', path.join(B, 'classes'), ...sources]);

// 3. class -> dex
const classes = [];
const walkC = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => e.isDirectory() ? walkC(path.join(d, e.name)) : e.name.endsWith('.class') && classes.push(path.join(d, e.name)));
walkC(path.join(B, 'classes'));
run(bat('d8'), ['--lib', JAR, '--min-api', '24', '--output', B, ...classes], { shell: true, env: { ...process.env, JAVA_HOME: path.dirname(JDK) } });

// 4. put classes.dex into the apk (existing entries are copied untouched)
run(SEVENZ, ['a', '-tzip', path.join(B, 'base.apk'), 'classes.dex'], { cwd: B });

// 5. align, then sign
run(path.join(BT, 'zipalign.exe'), ['-p', '-f', '4', path.join(B, 'base.apk'), path.join(B, 'aligned.apk')]);
if (!fs.existsSync(KS)) {
  run(path.join(JDK, 'keytool.exe'), ['-genkeypair', '-keystore', KS, '-alias', 'kana', '-keyalg', 'RSA', '-keysize', '2048',
    '-validity', '10000', '-storepass', KSPASS, '-keypass', KSPASS, '-dname', 'CN=Kana Lyrics, O=Personal']);
}
run(bat('apksigner'), ['sign', '--ks', KS, '--ks-pass', 'pass:' + KSPASS, '--out', OUT, path.join(B, 'aligned.apk')],
  { shell: true, env: { ...process.env, JAVA_HOME: path.dirname(JDK) } });
run(bat('apksigner'), ['verify', '--print-certs', OUT], { shell: true, env: { ...process.env, JAVA_HOME: path.dirname(JDK) } });
console.log('APK', OUT, Math.round(fs.statSync(OUT).size / 1024 / 1024 * 10) / 10, 'MB');
