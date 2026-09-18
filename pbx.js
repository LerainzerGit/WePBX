/**
 * Browser PBX Engine using PeerJS
 */
class BrowserPBX {
  constructor() {
    this.peer = null;
    this.currentExtension = null;
    this.displayName = 'Anonymous';
    this.onIncomingCallHandler = null;
  }

  register(extensionNumber, displayName, onReady) {
    const cleanExt = extensionNumber ? extensionNumber.toString().trim() : '';
    if (!cleanExt) {
      alert('Please enter a valid extension number.');
      return;
    }

    this.currentExtension = cleanExt;
    this.displayName = displayName && displayName.toString().trim() !== '' 
      ? displayName.toString().trim() 
      : `Ext ${cleanExt}`;
      
    const peerId = `pbx-ext-${cleanExt}`;

    // Clean up existing peer connection if registering again
    if (this.peer) {
      this.peer.destroy();
    }

    console.log(`[PBX] Registering extension: ${cleanExt} as "${this.displayName}"`);

    // Initialize PeerJS with reliable STUN servers
    this.peer = new Peer(peerId, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      }
    });

    this.peer.on('open', (id) => {
      console.log(`[PBX] Successfully registered with PeerID: ${id}`);
      if (typeof onReady === 'function') onReady(id);
    });

    this.peer.on('call', (mediaConnection) => {
      console.log('[PBX] Incoming media call received.');
      if (typeof this.onIncomingCallHandler === 'function') {
        this.onIncomingCallHandler(mediaConnection);
      }
    });

    this.peer.on('disconnected', () => {
      console.warn('[PBX] Peer disconnected from server. Attempting reconnect...');
      if (this.peer && !this.peer.destroyed) {
        this.peer.reconnect();
      }
    });

    this.peer.on('error', (err) => {
      console.error('[PBX Error]', err);
      if (err.type === 'unavailable-id') {
        alert(`Extension ${cleanExt} is already online on another tab or device.`);
      } else if (err.type === 'peer-unavailable') {
        alert(`Extension ${cleanExt} is offline or does not exist.`);
      } else {
        alert(`PBX Connection Error: ${err.type || err.message}`);
      }
    });
  }

  onIncomingCall(handler) {
    this.onIncomingCallHandler = handler;
  }
}
