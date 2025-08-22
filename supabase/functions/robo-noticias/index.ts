import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai@0.12.0'

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (_req) => {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    console.log("A limpar notícias antigas...");
    await supabaseAdmin.from('news_summaries').delete().gt('id', 0);
    console.log("Notícias antigas limpas.");

    console.log("Iniciando busca de notícias na Folha de S.Paulo...");
    const rssUrl = "https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Ffeeds.folha.uol.com.br%2Femcimadahora%2Frss091.xml";
    let response = await fetch(rssUrl);

    if (!response.ok) {
        console.warn(`Primeira tentativa falhou. A tentar novamente em 5 segundos...`);
        await sleep(5000);
        response = await fetch(rssUrl);
    }

    if (!response.ok) throw new Error(`Erro ao buscar RSS. Status: ${response.statusText}`);
    
    const newsData = await response.json();
    if (!newsData || !newsData.items) throw new Error("A resposta do RSS não continha itens válidos.");

    const newsItems = newsData.items.slice(0, 10);
    console.log(`Encontradas ${newsItems.length} notícias para processar.`);

    for (const item of newsItems) {
        try {
            const prompt = `
                Analise o conteúdo abaixo.
                Se não for uma notícia factual (ignore anúncios, opiniões, etc.), retorne {"is_news": false}.
                Se for uma notícia, retorne um JSON com "title" (máximo 60 caracteres) e "summary" (máximo 120 caracteres).
                Seja direto e objetivo. Não use markdown.

                Conteúdo:
                Título: ${item.title}
                Descrição: ${item.description}
            `;
            
            const result = await model.generateContent(prompt);
            const aiResponseText = await result.response.text();
            const jsonString = aiResponseText.replace(/```json|```/g, "").trim();
            const summaryData = JSON.parse(jsonString); // O ponto de falha anterior

            if (summaryData.is_news === false) {
                console.log(`Item "${item.title}" ignorado (não é notícia).`);
                continue;
            }

            if (summaryData.title && summaryData.summary) {
                await supabaseAdmin.from('news_summaries').insert({
                    source_url: item.link,
                    summary_title: summaryData.title,
                    summary_text: summaryData.summary
                });
                console.log(`Notícia "${summaryData.title}" salva.`);
            }
        } catch (parseError) {
            // --- NOVA LÓGICA "À PROVA DE FALHAS" ---
            console.error(`Falha ao processar a notícia "${item.title}". Erro: ${parseError.message}. A continuar para a próxima.`);
            // A execução continua para o próximo item do loop em vez de quebrar.
        }
    }
    return new Response("Processo de notícias concluído.", { status: 200 });
  } catch (err) {
    console.error("Erro fatal no robô de notícias:", err);
    return new Response(String(err?.message ?? err), { status: 500 });
  }
});