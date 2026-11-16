const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('loginEmail');
const passwordInput = document.getElementById('loginPassword');
const rememberInput = document.getElementById('rememberMe');
const statusMessage = document.getElementById('loginStatus');
const signInButton = document.getElementById('signInButton');
const signUpButton = document.getElementById('signUpButton');

let keepSignedIn = localStorage.getItem('mynotes_keep_signed_in') !== 'false';
rememberInput.checked = keepSignedIn;

const authStorage = {
    getItem(key) {
        return (keepSignedIn ? localStorage : sessionStorage).getItem(key);
    },
    setItem(key, value) {
        return (keepSignedIn ? localStorage : sessionStorage).setItem(key, value);
    },
    removeItem(key) {
        return (keepSignedIn ? localStorage : sessionStorage).removeItem(key);
    }
};

const config = window.MYNOTES_SUPABASE_CONFIG;
const supabaseClient = window.supabase?.createClient && config?.url && config?.publishableKey
    ? window.supabase.createClient(config.url, config.publishableKey, {
        auth: { persistSession: true, storage: authStorage }
    })
    : null;

function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.classList.toggle('is-error', isError);
}

function setBusy(isBusy) {
    signInButton.disabled = isBusy;
    signUpButton.disabled = isBusy;
}

async function openDashboardIfSignedIn() {
    if (!supabaseClient) {
        showStatus('Anmeldung ist derzeit nicht verfügbar. Du kannst MyNotes lokal weiter nutzen.', true);
        return;
    }
    try {
        const { data, error } = await supabaseClient.auth.getSession();
        if (error) throw error;
        if (data.session) window.location.replace('./dashboard.html');
    } catch (error) {
        console.error('Supabase-Sitzung konnte nicht geladen werden:', error);
        showStatus(`Sitzung konnte nicht geladen werden: ${error.message || error}`, true);
    }
}

async function authenticate(action) {
    if (!supabaseClient) {
        showStatus('Supabase ist momentan nicht verfügbar. Bitte lade die Seite online neu.', true);
        return;
    }
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) {
        showStatus('Bitte gib E-Mail-Adresse und Passwort ein.', true);
        return;
    }

    keepSignedIn = rememberInput.checked;
    localStorage.setItem('mynotes_keep_signed_in', String(keepSignedIn));
    setBusy(true);
    showStatus(action === 'signup' ? 'Konto wird erstellt …' : 'Anmeldung läuft …');
    try {
        const response = action === 'signup'
            ? await supabaseClient.auth.signUp({ email, password })
            : await supabaseClient.auth.signInWithPassword({ email, password });
        if (response.error) throw response.error;

        if (response.data.session) {
            window.location.replace('./dashboard.html');
        } else if (action === 'signup') {
            showStatus('Konto erstellt. Bitte bestätige den Link in deiner E-Mail und melde dich danach an.');
            passwordInput.value = '';
        } else {
            showStatus('Bitte bestätige zuerst den Link in deiner E-Mail und melde dich anschließend an.', true);
        }
    } catch (error) {
        console.error(`Supabase-${action === 'signup' ? 'Registrierung' : 'Anmeldung'} fehlgeschlagen:`, error);
        showStatus(`${action === 'signup' ? 'Registrierung' : 'Anmeldung'} fehlgeschlagen: ${error.message || error}`, true);
    } finally {
        setBusy(false);
    }
}

loginForm.addEventListener('submit', event => {
    event.preventDefault();
    void authenticate('signin');
});
signUpButton.addEventListener('click', () => void authenticate('signup'));

void openDashboardIfSignedIn();
