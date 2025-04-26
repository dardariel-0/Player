const clientId = "b3291a18cc094504a0d0094f73e1215c";
const redirectUri = "https://player-daniel.netlify.app/callback"; // MESMO que configurei no spot
const scopes = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "playlist-read-private",
  "streaming",
];

// Funções para PKCE
async function generateCodeVerifier() {
  let array = new Uint8Array(64);
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

async function fetchPlaylist(access_token) {
  const playlistId = "3bM016MXIWljN8rQVtztBL"; //
  const response = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    }
  );
  const data = await response.json();

  const ul = document.getElementById("playlist");
  data.items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent =
      item.track.name +
      " - " +
      item.track.artists.map((a) => a.name).join(", ");
    ul.appendChild(li);
  });
}

async function handleRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");

  if (code) {
    const access_token = await fetchAccessToken(code);
    fetchPlaylist(access_token);
  }
}

handleRedirect();
