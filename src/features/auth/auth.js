import { supabase } from '/src/shared/js/supabase-client.js';

// --- Seletores de Elementos ---
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const feedbackMessage = document.getElementById('feedback-message');
const forgotPasswordLink = document.getElementById('forgot-password-link');
const openSignupModalBtn = document.getElementById('open-signup-modal-btn');
const signupModal = document.getElementById('signup-modal');
const closeSignupModalBtn = document.getElementById('close-signup-modal');

// --- Lógica de Login (inalterada) ---
loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = '/src/features/dashboard/dashboard.html';
    } catch (error) {
        showFeedback(`Erro no login: ${error.message}`, 'error');
    }
});

// --- Lógica de "Esqueci Minha Senha" ---
forgotPasswordLink.addEventListener('click', async (event) => {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    if (!email) {
        showFeedback('Por favor, digite seu e-mail no campo acima antes de clicar em "Esqueci minha senha".', 'error');
        return;
    }

    try {
        // DEPOIS:
       const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/src/features/auth/reset-password.html',
    });
        if (error) throw error;
        showFeedback('Link de redefinição de senha enviado para o seu e-mail!', 'success');
    } catch (error) {
        showFeedback(`Erro: ${error.message}`, 'error');
    }
});

// --- Lógica do Modal de Cadastro ---
openSignupModalBtn.addEventListener('click', (e) => {
    e.preventDefault();
    signupModal.style.display = 'flex';
});
closeSignupModalBtn.addEventListener('click', () => {
    signupModal.style.display = 'none';
});
signupModal.addEventListener('click', (e) => {
    if (e.target === signupModal) { // Fecha o modal se clicar fora do conteúdo
        signupModal.style.display = 'none';
    }
});

// --- Lógica de Solicitação de Cadastro (inalterada) ---
signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const clientName = document.getElementById('signup-client-name').value;
    const userEmail = document.getElementById('signup-email').value;
    const submitButton = signupForm.querySelector('button');
    submitButton.disabled = true;
    submitButton.textContent = 'Enviando...';

    try {
        const { error } = await supabase.functions.invoke('receber-pedido', {
            body: { client_name: clientName, user_email: userEmail },
        });
        if (error) throw error;
        showFeedback('Solicitação enviada com sucesso! Entraremos em contato.', 'success');
        signupForm.reset();
        signupModal.style.display = 'none';
    } catch (error) {
        showFeedback(`Erro: ${error.message}`, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Enviar Solicitação';
    }
});

// --- Função de Feedback Visual (inalterada) ---
function showFeedback(message, type = 'success') {
    feedbackMessage.textContent = message;
    feedbackMessage.className = `toast show ${type}`;
    setTimeout(() => {
        feedbackMessage.classList.remove('show');
    }, 5000);
}