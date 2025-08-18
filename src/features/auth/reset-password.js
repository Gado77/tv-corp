// src/features/auth/reset-password.js

// CORREÇÃO 1: Caminho relativo para encontrar o ficheiro na pasta 'shared'
import { supabase } from '../../shared/js/supabase-client.js';

const resetForm = document.getElementById('reset-password-form');
const newPasswordInput = document.getElementById('new-password');
const messageArea = document.getElementById('message-area');
const feedbackMessage = document.getElementById('feedback-message');

/**
 * --- SOLUÇÃO PARA O PROBLEMA DE TIMING (RACE CONDITION) ---
 * Esta função é executada assim que a página carrega.
 * Ela lê o URL diretamente para encontrar o token de recuperação antes que a biblioteca do Supabase o remova.
 * Isso garante que o formulário seja exibido de forma confiável.
 */
window.addEventListener('DOMContentLoaded', () => {
    // Pega o fragmento do URL (a parte depois do #)
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.substring(1)); // Remove o '#' inicial

    // Verifica se os parâmetros de um link de recuperação ou convite existem
    if (params.has('access_token') && (params.get('type') === 'recovery' || params.get('type') === 'invite')) {
        console.log("Token de recuperação/convite encontrado no URL. Exibindo o formulário.");
        messageArea.textContent = "Link válido. Por favor, crie sua nova senha.";
        resetForm.style.display = 'block';
    }
});


// --- Lidar com o Evento de Redefinição de Senha (Fallback) ---
// Mantemos este listener como um fallback, caso o método acima falhe por algum motivo.
supabase.auth.onAuthStateChange(async (event, session) => {
    // Este evento dispara na página de redirecionamento com o token
    if (event === "PASSWORD_RECOVERY") {
        console.log("Evento PASSWORD_RECOVERY do Supabase detetado.");
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