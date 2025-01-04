const express = require('express');
const cors = require('cors');
const {generateSlug} = require('random-word-slugs');
const {ECSClient, RunTaskCommand} = require('@aws-sdk/client-ecs');
const {Server} = require('socket.io')
const Redis = require('ioredis')

const app = express();
const PORT = 9000;


const subscriber = new Redis('')

const io = new Server({cors: '*'})

io.on('connection', socket => {
    socket.on('subscribe', channel => {
        socket.join(channel);
        socket.emit('message', `joined ${channel}`);
    })
})

io.listen(9002, () => console.log('Socket Server Running..9002'));

const ecsClient = new ECSClient({
    region: '',
    credentials: {
        accessKeyId: '',
        secretAccessKey: ''
    }
});

const config = {
    CLUSTER: '',
    TASK: ''
}

app.use(cors());
app.use(express.json());

app.post('/project', async(req, res) => {
    const {gitURL, slug} = req.body;
    const projectSlug = slug ? slug : generateSlug();
    // spin the container ECS
    const command = new RunTaskCommand({
        cluster: config.CLUSTER,
        taskDefinition: config.TASK,
        launchType: 'FARGATE',
        count: 1,
        networkConfiguration: {
            awsvpcConfiguration: {
                assignPublicIp: 'ENABLED',
                subnets: [''],
                securityGroups: [''],
            }
        },
        overrides: {
            containerOverrides: [
                {
                    name: 'builder-image',
                    environment: [
                        {
                            name: 'GIT_REPOSITORY__URL',
                            value: gitURL
                        },
                        {
                            name: 'PROJECT_ID',
                            value: projectSlug
                        }
                    ]
                }
            ]
        }
    });

    await ecsClient.send(command);

    return res.json({statusbar: 'queued', data: {projectSlug, url: `http://${projectSlug}.localhost:8000`}});
    
})

async function initRedisSubscribe() {
    console.log('Subscribed to logs');
    subscriber.psubscribe('logs:*')
    subscriber.on('pmessage', (pattern, channel, message) => {
        io.to(channel).emit('message', message);
    })
}

initRedisSubscribe();

app.listen(PORT, () => console.log(`API Server Running..${PORT}`));