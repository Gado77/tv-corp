// CORREÇÃO 1: Caminho absoluto para o import a partir da raiz do site
import { supabase } from '/src/shared/js/supabase-client.js';

// --- Seletores de Elementos ---
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const feedbackMessage = document.getElementById('feedback-message');
const forgotPasswordLink = document.getElementById('forgot-password-link');
const openSignupModalBtn = document.getElementById('open-signup-modal-btn');
const signupModal = document.getElementById('signup-modal');
const closeSignupModalBtn = document.getElementById('close-signup-modal');

// --- Lógica de Login ---
loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // CORREÇÃO 2: Usa o caminho absoluto para o dashboard
        window.location.href = '/src/features/dashboard/dashboard.html';
    } catch (error) {
        showFeedback(`Erro no login: ${error.message}`, 'error');
    }
});

// --- LÓGICA DE "ESQUECI MINHA SENHA" (ATUALIZADA) ---
forgotPasswordLink.addEventListener('click', async (event) => {
    event.preventDefault();
    // CORREÇÃO 3: Lê o e-mail do campo de login da página, em vez de usar um prompt.
    const email = document.getElementById('login-email').value;
    
    if (!email) {
        showFeedback('Por favor, digite seu e-mail no campo acima antes de clicar em "Esqueci minha senha".', 'error');
        return;
    }

    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            // CORREÇÃO 4: Usa o caminho absoluto para a página de reset de senha
            redirectTo: window.location.origin + '/src/features/auth/reset-password.html',
        });
        if (error) throw error;
        showFeedback('Se existir uma conta com este e-mail, um link de redefinição foi enviado.', 'success');
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
    if (e.target === signupModal) {
        signupModal.style.display = 'none';
    }
});

// --- Lógica de Solicitação de Cadastro ---
signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const clientName = document.getElementById('signup-client-name').value;
    const userEmail = document.getElementById('signup-email').value;
    const submitButton = signupForm.querySelector('button');
    submitButton.disabled = true;
    submitButton.textContent = 'A enviar...';

    try {
        const { error } = await supabase.functions.invoke('receber-pedido', {
            body: { client_name: clientName, user_email: userEmail },
        });
        if (error) throw error;
        showFeedback('Solicitação enviada com sucesso! Receberá um e-mail quando a sua conta for aprovada.', 'success');
        signupForm.reset();
        signupModal.style.display = 'none';
    } catch (error) {
        showFeedback(`Erro: ${error.message}`, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Enviar Solicitação';
    }
});

// --- Função de Feedback Visual ---
function showFeedback(message, type = 'success', duration = 4000) {
    feedbackMessage.textContent = message;
    feedbackMessage.className = `toast show ${type}`;
    setTimeout(() => {
        feedbackMessage.classList.remove('show');
    }, duration);
}