// Configuration from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const config = {
    s3Bucket: urlParams.get('s3_bucket'),
    s3Region: urlParams.get('s3_region'),
    s3Key: urlParams.get('s3_key'),
    s3Secret: urlParams.get('s3_secret'),
    haUrl: urlParams.get('ha_url'),
    haToken: urlParams.get('ha_token'),
    speakerId: urlParams.get('speaker_id'),
    speakerName: urlParams.get('speaker_name'),
};

// Validate configuration
if (!config.s3Bucket || !config.s3Region || !config.s3Key || !config.s3Secret || 
    !config.haUrl || !config.haToken || !config.speakerId) {
    document.getElementById('status').innerHTML = 'Error: Missing configuration parameters';
    document.getElementById('recordButton').disabled = true;
    throw new Error('Missing configuration parameters');
}

console.log({
    region: config.s3Region,
    accessKeyId: config.s3Key,
    secretAccessKey: config.s3Secret,
    signatureVersion: 'v4'
})

// Initialize AWS SDK
AWS.config.update({
    region: config.s3Region,
    accessKeyId: config.s3Key,
    secretAccessKey: config.s3Secret,
    signatureVersion: 'v4'
});
const s3 = new AWS.S3({
    region: config.s3Region,
    accessKeyId: config.s3Key,
    secretAccessKey: config.s3Secret,
    signatureVersion: 'v4'
});

// Recording variables
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let timerInterval;
let startTime;

// DOM elements
const recordButton = document.getElementById('recordButton');
const statusElement = document.getElementById('status');
const timerElement = document.getElementById('timer');
const uploadStatusElement = document.getElementById('uploadStatus');
const speakerNameElement = document.getElementById('speakerName');

speakerNameElement.textContent = 'Speaker: ' + config.speakerName;

// Request microphone access
async function setupRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            await uploadToS3(audioBlob);
        };

        statusElement.textContent = 'Ready to record';
        recordButton.disabled = false;
    } catch (error) {
        statusElement.textContent = `Error: ${error.message}`;
        recordButton.disabled = true;
    }
}

// Timer function
function updateTimer() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const seconds = (elapsed % 60).toString().padStart(2, '0');
    timerElement.textContent = `${minutes}:${seconds}`;
}

// Record button handler
recordButton.addEventListener('click', () => {
    if (!isRecording) {
        // Start recording
        audioChunks = [];
        mediaRecorder.start();
        isRecording = true;
        recordButton.textContent = 'Stop Recording';
        recordButton.classList.add('recording');
        statusElement.textContent = 'Recording...';
        startTime = Date.now();
        timerInterval = setInterval(updateTimer, 1000);
    } else {
        // Stop recording
        mediaRecorder.stop();
        isRecording = false;
        recordButton.textContent = 'Start Recording';
        recordButton.classList.remove('recording');
        statusElement.textContent = 'Processing...';
        clearInterval(timerInterval);
    }
});

// Upload to S3
async function uploadToS3(audioBlob) {
    const fileName = `${uuid.v4()}.webm`;
    uploadStatusElement.textContent = 'Starting upload...';
    
    try {
        // Upload to S3
        const upload = s3.upload({
            Bucket: config.s3Bucket,
            Key: fileName,
            Body: audioBlob,
            ContentType: 'audio/webm',
            ACL: 'public-read'
        });

        upload.on('httpUploadProgress', (progress) => {
            const percentage = Math.round((progress.loaded / progress.total) * 100);
            uploadStatusElement.textContent = `Uploading: ${percentage}%`;
        });

        await new Promise((resolve, reject) => {
            upload.send((err, data) => {
                if (err) {
                    console.error('Upload error:', err);
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });

        const fileUrl = `https://s3.${config.s3Region}.amazonaws.com/${config.s3Bucket}/${fileName}`;
        uploadStatusElement.textContent = 'Upload successful';
        
        // Play on Home Assistant
        await playOnHomeAssistant(fileUrl);
    } catch (error) {
        uploadStatusElement.textContent = `Upload error: ${error.message}`;
        uploadStatusElement.classList.add('error');
    }
}

// Play audio through Home Assistant
async function playOnHomeAssistant(audioUrl) {
    try {
        const response = await fetch(`${config.haUrl}/api/services/media_player/play_media`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.haToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                entity_id: config.speakerId,
                media_content_id: audioUrl,
                media_content_type: 'music'
            })
        });

        if (!response.ok) {
            throw new Error(`Home Assistant API error: ${response.status}`);
        }

        statusElement.textContent = 'Playing on speaker';
        statusElement.classList.add('success');
    } catch (error) {
        statusElement.textContent = `Play error: ${error.message}`;
        statusElement.classList.add('error');
    }
}

// Initialize
setupRecording();
