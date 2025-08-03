import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai@0.12.0'

Deno.serve(async (_req) => {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    console.log("Iniciando busca de notícias...");
    const rssUrl = "https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fg1.globo.com%2Frss%2Fg1%2F";
    const response = await fetch(rssUrl);
    const newsData = await response.json();
    const newsItems = newsData.items.slice(0, 5);
    console.log(`Encontradas ${newsItems.length} notícias.`);

    for (const item of newsItems) {
        const prompt = `Você é um editor para um sistema de TV Corporativa. Resuma a seguinte notícia em um formato JSON com as chaves "title" e "summary". O "title" deve ter no máximo 10 palavras. O "summary" deve ter no máximo 30 palavras. Não use markdown. Notícia: Título: ${item.title}. Conteúdo: ${item.description}`;
        
        const result = await model.generateContent(prompt);
        const aiResponseText = await result.response.text();
        const jsonString = aiResponseText.replace(/```json|```/g, "").trim();
        const summaryData = JSON.parse(jsonString);

        if (summaryData.title && summaryData.summary) {
            await supabaseAdmin.from('news_summaries').insert({
                source_url: item.link,
                summary_title: summaryData.title,
                summary_text: summaryData.summary
            });
            console.log(`Notícia "${summaryData.title}" salva.`);
        }
    }
    return new Response("Processo de notícias concluído.", { status: 200 });
  } catch (err) {
    console.error("Erro no robô de notícias:", err);
    return new Response(String(err?.message ?? err), { status: 500 });
  }
});