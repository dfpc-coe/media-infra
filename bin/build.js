import CP from 'child_process';

process.env.GITSHA = sha();
process.env.DOCKER_PLATFORMS = process.env.DOCKER_PLATFORMS || 'linux/amd64,linux/arm64';

process.env.Environment = process.env.Environment || 'prod';

for (const env of [
    'GITSHA',
    'AWS_REGION',
    'AWS_ACCOUNT_ID',
    'Environment',
]) {
    if (!process.env[env]) {
        console.error(`${env} Env Var must be set`);
        process.exit();
    }
}

await login();
console.error('ok - building containers');
await tak();

function login() {
    console.error('ok - logging in')

    return new Promise((resolve, reject) => {
        const $ = CP.exec(`
            aws ecr get-login-password \
                --region $\{AWS_REGION\} \
            | docker login \
                --username AWS \
                --password-stdin "$\{AWS_ACCOUNT_ID\}.dkr.ecr.$\{AWS_REGION\}.amazonaws.com"

        `, (err) => {
            if (err) return reject(err);
            return resolve();
        });

        $.stdout.pipe(process.stdout);
        $.stderr.pipe(process.stderr);
    });

}

function tak() {
    return new Promise((resolve, reject) => {
        const image = `${process.env.AWS_ACCOUNT_ID}.dkr.ecr.${process.env.AWS_REGION}.amazonaws.com/tak-vpc-${process.env.Environment}-cloudtak-media:${process.env.GITSHA}`;
        const $ = CP.exec(`
            docker buildx build \
                --platform "$\{DOCKER_PLATFORMS\}" \
                --tag "${image}" \
                --push \
                .
        `, (err) => {
            if (err) return reject(err);
            return resolve();
        });

        $.stdout.pipe(process.stdout);
        $.stderr.pipe(process.stderr);
    });
}

function sha() {
    const git = CP.spawnSync('git', [
        '--git-dir', new URL('../.git', import.meta.url).pathname,
        'rev-parse', 'HEAD'
    ]);

    if (!git.stdout) throw Error('Is this a git repo? Could not determine GitSha');
    return String(git.stdout).replace(/\n/g, '');

}
