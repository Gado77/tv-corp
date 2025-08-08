import { supabase } from '../../shared/js/supabase-client.js';

const resetForm = document.getElementById('reset-password-form');
const newPasswordInput = document.getElementById('new-password');
const messageArea = document.getElementById('message-area');
const feedbackMessage = document.getElementById('feedback-message');

// --- Função de Feedback Visual ---
function showFeedback(message, type = 'success', duration = 4000) {
    feedbackMessage.textContent = message;
    feedbackMessage.className = `toast show ${type}`;
    setTimeout(() => {
        feedbackMessage.classList.remove('show');
    }, duration);
}

// --- Lidar com o Evento de Redefinição de Senha ---
supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('Evento de autenticação detetado:', event);

    // O listener ainda existe como uma segunda forma de verificação,
    // mas a lógica principal está no código de inicialização abaixo.
    if (event === "PASSWORD_RECOVERY") {
        messageArea.textContent = "Token verificado. Pode criar sua nova senha.";
        resetForm.style.display = 'block';
    }
});

// --- Lidar com o Envio do Formulário ---
resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitButton = e.target.querySelector('button');
    submitButton.disabled = true;
    submitButton.textContent = 'A salvar...';

    const newPassword = newPasswordInput.value;

    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
        showFeedback(`Erro ao atualizar a senha: ${error.message}`, 'error');
        submitButton.disabled = false;
        submitButton.textContent = 'Salvar Nova Senha';
    } else {
        messageArea.textContent = "Senha atualizada com sucesso! A redirecionar para o login...";
        resetForm.style.display = 'none';
        showFeedback('Senha atualizada com sucesso!', 'success');
        
        setTimeout(() => {
            window.location.href = './auth.html';
        }, 3000);
    }
});


// --- INICIALIZAÇÃO DA PÁGINA (LÓGICA CORRIGIDA) ---
window.addEventListener('DOMContentLoaded', () => {
    // CORREÇÃO: Lê o hash do URL manualmente para detetar o token
    // A biblioteca do Supabase limpa isto muito rapidamente, por isso precisamos de o "apanhar" logo.
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.substring(1)); // Remove o '#' inicial
    
    // Verifica se os parâmetros de um link de recuperação/convite existem
    if (params.has('access_token') && (params.get('type') === 'recovery' || params.get('type') === 'invite')) {
        console.log("Token de recuperação/convite encontrado no URL. A exibir o formulário.");
        messageArea.textContent = "Link válido. Por favor, crie sua nova senha.";
        resetForm.style.display = 'block';
    }
});