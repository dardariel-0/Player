const clientId = "b3291a18cc094504a0d0094f73e1215c";
const redirectUri = "https://player-daniel.netlify.app";
const playlistId = "3bM016MXIWljN8rQVtztBL";

const scopes = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "streaming",
  "playlist-read-private",
  "user-read-currently-playing",
];

// PKCE
async function generateCodeVerifier() {
  const array = new Uint8Array(64);
  window.crypto.getRandomValues(array);
  return btoa(String.fromCharCode.apply(null, array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function generateCodeChallenge(codeVerifier) {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

document.getElementById("login-btn").onclick = async () => {
  const codeVerifier = await generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  localStorage.setItem("code_verifier", codeVerifier);

  const authUrl =
    `https://accounts.spotify.com/authorize?` +
    `client_id=${clientId}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scopes.join(" "))}` +
    `&code_challenge_method=S256` +
    `&code_challenge=${codeChallenge}`;

  window.location = authUrl;
};

async function fetchAccessToken(code) {
  const codeVerifier = localStorage.getItem("code_verifier");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body,
  });

  const data = await response.json();
  return data.access_token;
}

async function handleRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");

  if (code) {
    const access_token = await fetchAccessToken(code);
    window.access_token = access_token;
    setupSpotifyPlayer(access_token);
  }
}

function setupSpotifyPlayer(access_token) {
  window.onSpotifyWebPlaybackSDKReady = () => {
    const player = new Spotify.Player({
      name: "Meu Web Player",
      getOAuthToken: (cb) => {
        cb(access_token);
      },
      volume: 0.7,
    });

    player.connect();

    player.addListener("ready", ({ device_id }) => {
      console.log("Player pronto! Device ID", device_id);
      window.device_id = device_id;
      document.getElementById("login-btn").style.display = "none";
      document.getElementById("player").style.display = "block";
      fetchCurrentlyPlaying();
    });

    player.addListener("player_state_changed", (state) => {
      if (!state) return;
      const current_track = state.track_window.current_track;
      updateTrackInfo(current_track);
    });

    document.getElementById("play-btn").onclick = () => player.resume();
    document.getElementById("pause-btn").onclick = () => player.pause();
    document.getElementById("next-btn").onclick = () => player.nextTrack();
    document.getElementById("prev-btn").onclick = () => player.previousTrack();
    document.getElementById("play-playlist-btn").onclick = () => playPlaylist();

    window.player = player;
  };
}

async function fetchCurrentlyPlaying() {
  const res = await fetch(
    "https://api.spotify.com/v1/me/player/currently-playing",
    {
      headers: {
        Authorization: `Bearer ${window.access_token}`,
      },
    }
  );
  if (res.ok) {
    const data = await res.json();
    updateTrackInfo(data.item);
  }
}

function updateTrackInfo(track) {
  document.getElementById("album-cover").src = track.album.images[0].url;
  document.getElementById("track-name").textContent = track.name;
  document.getElementById("artist-name").textContent = track.artists
    .map((a) => a.name)
    .join(", ");
}

async function playPlaylist() {
  const url = `https://api.spotify.com/v1/me/player/play?device_id=${window.device_id}`;
  await fetch(url, {
    method: "PUT",
    body: JSON.stringify({ context_uri: `spotify:playlist:${playlistId}` }),
    headers: {
      Authorization: `Bearer ${window.access_token}`,
      "Content-Type": "application/json",
    },
  });
}

handleRedirect();
