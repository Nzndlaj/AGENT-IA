/**
 * Workflow 4: 🖼️ Sub-Workflow Générer Image DALL-E 3
 * ID: oFAryAKZmbyzuBTZ
 * URL: https://nz0439.app.n8n.cloud/workflow/oFAryAKZmbyzuBTZ
 *
 * Sous-workflow appelé par le CEO AI Agent (workflow 1) via l'outil
 * "Outil Generer Image" (toolWorkflow).
 *
 * Flux:
 *   Execute Workflow Trigger (reçoit prompt) →
 *   HTTP Request POST api.openai.com/v1/images/generations →
 *   Code (extraire URL de la réponse)
 *
 * Input attendu:
 *   - prompt (string): Description de l'image à générer en anglais
 *
 * Output retourné:
 *   - response (string): Message avec l'URL de l'image
 *   - imageUrl (string): URL directe de l'image générée
 *   - revisedPrompt (string): Prompt révisé par DALL-E
 *
 * Credentials nécessaires:
 *   - "OpenAI Bearer" (httpBearerAuth): Clé API OpenAI en Bearer token
 *     → Créer dans n8n: Credentials → Add → HTTP Bearer Auth
 *     → Token = votre clé API OpenAI (sk-...)
 *
 * Créé le 2026-04-12 pour remplacer le sous-workflow K42AR1vlBO7XAgBc
 * qui était inaccessible/cassé.
 */

const wf = workflow('🖼️ Sub-Workflow Générer Image DALL-E 3');

const subTrigger = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  name: 'Recevoir Prompt',
  config: {
    inputSource: 'workflowInputs',
    workflowInputs: {
      values: [
        { name: 'prompt', type: 'string' }
      ]
    }
  }
});

const callDalle = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  name: 'Appel DALL-E 3 API',
  config: {
    method: 'POST',
    url: 'https://api.openai.com/v1/images/generations',
    authentication: 'genericCredentialType',
    genericAuthType: 'httpBearerAuth',
    sendBody: true,
    contentType: 'json',
    specifyBody: 'json',
    jsonBody: expr("{{ JSON.stringify({ model: 'dall-e-3', prompt: $json.prompt || 'A beautiful image', n: 1, size: '1024x1024' }) }}"),
    options: { timeout: 60000 }
  },
  credentials: { httpBearerAuth: newCredential('OpenAI Bearer') }
});

const formatResponse = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  name: 'Formater Réponse',
  config: {
    mode: 'runOnceForEachItem',
    jsCode: `const data = $input.item.json;
const url = data && data.data && data.data[0] ? data.data[0].url : '';
const revisedPrompt = data && data.data && data.data[0] ? data.data[0].revised_prompt : '';
if (!url) {
  return { json: { response: 'Erreur: impossible de générer image.' } };
}
return { json: { response: 'Image générée avec succès! Voici le lien: ' + url, imageUrl: url, revisedPrompt: revisedPrompt } };`
  }
});

wf.add(subTrigger.to(callDalle).to(formatResponse));

export default wf;
