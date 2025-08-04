// CORREÇÃO 1: Caminho relativo para encontrar o ficheiro na pasta 'shared'
import { supabase } from '../../shared/js/supabase-client.js';

const resetForm = document.getElementById('reset-password-form');
const newPasswordInput = document.getElementById('new-password');
const messageArea = document.getElementById('message-area');
const feedbackMessage = document.getElementById('feedback-message');

// --- Lidar com o Evento de Redefinição de Senha ---
// O Supabase usa um evento especial 'PASSWORD_RECOVERY' após o redirecionamento
supabase.auth.onAuthStateChange(async (event, session) => {
    // Este evento só dispara na página de redirecionamento com o token
    if (event === "PASSWORD_RECOVERY") {
        messageArea.textContent = "Token verificado. Você já pode criar sua nova senha.";
        resetForm.style.display = 'block';
    }
});

// --- Lidar com o Envio do Formulário ---
resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPassword = newPasswordInput.value;

    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
        showFeedback(`Erro ao atualizar a senha: ${error.message}`, 'error');
    } else {
        messageArea.textContent = "Senha atualizada com sucesso! Você já pode fazer o login.";
        resetForm.style.display = 'none'; // Esconde o formulário
        showFeedback('Senha atualizada com sucesso!', 'success');
        
        // CORREÇÃO 2: Caminho relativo para a página de login
        // Redireciona para a página de login após 3 segundos
        setTimeout(() => {
            window.location.href = './auth.html';
        }, 3000);
    }
});

// --- Função de Feedback Visual ---
function showFeedback(message, type = 'success') {
    feedbackMessage.textContent = message;
    feedbackMessage.className = `toast show ${type}`;
    setTimeout(() => {
        feedbackMessage.classList.remove('show');
    }, 5000);
}