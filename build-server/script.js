const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const mime = require('mime-types');
const Redis = require('ioredis');


const publisher = new Redis('');

const s3Client = new S3Client({
    region: '',
    credentials: {
        accessKeyId: '',
        secretAccessKey: ''
    }
});

const PROJECT_ID = process.env.PROJECT_ID;

function publishLog(log) {
    publisher.publish(`logs:${PROJECT_ID}`, JSON.stringify({ log }));
}


async function init() {
    console.log('Executing script.js');
    publishLog('Build Started...');
    const outDirPath = path.join(__dirname, 'output');

    const p = exec(`cd ${outDirPath} && npm install && npm run build`)

    p.stdout.on('data', function(data) {
        console.log(data.toString())
        publishLog(data.toString());
    })
    p.stdout.on('error', function(data) {
        console.log('error', data.toString())
        publishLog(`error: ${data.toString()}`);
    })

   
    p.on('close', async function() {
        console.log('Build completed')
        publishLog('Build Completed');
        const distFolderPath = path.join(__dirname, 'output', 'dist');
        const distFolderContents = fs.readdirSync(distFolderPath, { recursive: true });

        publishLog('Uploading files to S3...');
        for (const file of distFolderContents) {
            const filePath = path.join(distFolderPath, file);
            if (fs.lstatSync(filePath).isDirectory()) continue;

            console.log('Uploading', filePath);
            publishLog(`Uploading ${file}`);
            
            const command = new PutObjectCommand({
                Bucket: 'vercelclone-outputs',
                Key: `__output/${PROJECT_ID}/${file}`,
                Body: fs.createReadStream(filePath),
                ContentType: mime.lookup(filePath)
            });

            await s3Client.send(command);
            publishLog(`Uploaded ${file}`);
            console.log('Uploaded', filePath);

        }
        publishLog('Done');
        console.log('Done');
    })
}

init();