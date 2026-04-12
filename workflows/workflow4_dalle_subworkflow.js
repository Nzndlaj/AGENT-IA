/**
 * Workflow 4: 🖼️ Sub-Workflow Générer Image DALL-E 3
 * ID: oFAryAKZmbyzuBTZ (déployé via SDK, paramètres NON persistés - voir note)
 * URL: https://nz0439.app.n8n.cloud/workflow/oFAryAKZmbyzuBTZ
 *
 * Sous-workflow appelé par le CEO AI Agent (workflow 1) via l'outil
 * "Outil Generer Image" (toolWorkflow).
 *
 * Flux:
 *   Execute Workflow Trigger (reçoit prompt) →
 *   OpenAI (resource: image, operation: generate, model: dall-e-3) →
 *   Code (formater la réponse avec URL)
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
 *   - openAiApi: Credential OpenAI API (auto-assignée: "n8n free OpenAI API credits")
 *
 * ⚠️ IMPORTANT: Le SDK n8n ne persiste PAS les paramètres des noeuds.
 *   Le workflow déployé via update_workflow a des noeuds VIDES.
 *   Pour un workflow fonctionnel, IMPORTER le fichier JSON:
 *   → fix_dalle_subworkflow_import.json
 *
 * Créé le 2026-04-12. Utilise le node OpenAI natif (pas HTTP Request)
 * pour que la credential soit auto-assignée.
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

const generateImage = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.1,
  name: 'Générer Image DALL-E 3',
  config: {
    resource: 'image',
    operation: 'generate',
    model: 'dall-e-3',
    prompt: expr('={{ $json.prompt }}'),
    options: {
      dalleQuality: 'standard',
      size: '1024x1024',
      style: 'vivid',
      returnImageUrls: true
    }
  },
  credentials: { openAiApi: newCredential('OpenAI API') }
});

const formatResponse = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  name: 'Formater Réponse',
  config: {
    mode: 'runOnceForEachItem',
    jsCode: `const data = $input.item.json;
const url = data.url || (data.data && data.data[0] ? data.data[0].url : '');
const revisedPrompt = data.revised_prompt || (data.data && data.data[0] ? data.data[0].revised_prompt : '');
if (!url) {
  return { json: { response: 'Erreur: impossible de générer image.' } };
}
return { json: { response: 'Image générée avec succès! Voici le lien: ' + url, imageUrl: url, revisedPrompt: revisedPrompt } };`
  }
});

wf.add(subTrigger.to(generateImage).to(formatResponse));

export default wf;
