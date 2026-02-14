const socket = io();
const meetBtn = document.getElementById('meetBtn');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const statusDiv = document.getElementById('status');

let localStream;
let peer;
let currentPartner = null;
let isInCall = false;

// Get user media (camera only, always on)
async function initLocalStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true  // Always on as requested
        });
        localVideo.srcObject = localStream;
        updateStatus('Ready to meet someone new', 'connected');
    } catch (err) {
        console.error('Error accessing camera:', err);
        updateStatus('Camera access denied. Please enable camera permissions.', 'error');
        meetBtn.disabled = true;
    }
}

// Update status with visual feedback
function updateStatus(message, type = 'info') {
    statusDiv.innerHTML = `<span class="status-dot" style="background: ${
        type === 'connected' ? '#4CAF50' : 
        type === 'error' ? '#f44336' : 
        '#ff9800'
    }"></span> ${message}`;
}

// Create peer connection
function createPeer(initiator, partnerId) {
    peer = new SimplePeer({
        initiator: initiator,
        stream: localStream,
        trickle: false
    });

    peer.on('signal', (data) => {
        socket.emit('signal', { target: partnerId, signal: data });
    });

    peer.on('stream', (remoteStream) => {
        remoteVideo.srcObject = remoteStream;
        updateStatus('Connected! Say hi to your new friend', 'connected');
        isInCall = true;
        meetBtn.innerHTML = `
            <span class="btn-text">NEXT</span>
            <span class="btn-subtext">Meet Someone Else</span>
        `;
    });

    peer.on('close', () => {
        if (isInCall) {
            endCall();
        }
    });

    peer.on('error', (err) => {
        console.error('Peer error:', err);
        endCall();
    });
}

// End current call
function endCall() {
    if (peer) {
        peer.destroy();
        peer = null;
    }
    if (remoteVideo.srcObject) {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
    }
    currentPartner = null;
    isInCall = false;
    updateStatus('Disconnected. Click MEET to find someone new');
    meetBtn.innerHTML = `
        <span class="btn-text">MEET</span>
        <span class="btn-subtext">Someone New</span>
    `;
}

// Find a partner
function findPartner() {
    if (isInCall) {
        // If in call, disconnect current and find new
        endCall();
    }
    
    updateStatus('Looking for someone...', 'searching');
    meetBtn.disabled = true;
    socket.emit('find-partner');
    
    // Reset button after timeout if no partner found
    setTimeout(() => {
        if (!isInCall) {
            meetBtn.disabled = false;
            updateStatus('No one available. Try again!');
        }
    }, 30000);
}

// Socket event handlers
socket.on('partner-found', (partnerId) => {
    currentPartner = partnerId;
    meetBtn.disabled = false;
    
    if (peer) {
        // If we already have a peer, we're the initiator
        createPeer(true, partnerId);
    } else {
        // We're the responder
        createPeer(false, partnerId);
    }
});

socket.on('signal', (data) => {
    if (peer) {
        peer.signal(data.signal);
    }
});

socket.on('partner-disconnected', () => {
    endCall();
    updateStatus('Partner disconnected. Click MEET to find someone new');
    meetBtn.disabled = false;
});

// Initialize on page load
initLocalStream();

// MEET button click handler
meetBtn.addEventListener('click', findPartner);

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (peer) {
        peer.destroy();
    }
});