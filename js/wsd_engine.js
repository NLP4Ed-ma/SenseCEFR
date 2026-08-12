/**
 * Word Sense Disambiguation (WSD) Engine
 * Implements:
 * 1. Morphological Stemmer & Root Normalizer
 * 2. Lemmatized Lesk Algorithm with Context Weighting & Semantic Expansion
 * 3. Google Gemini AI REST API integration
 */

function stemWord(w) {
  if (!w || w.length <= 3) return w;
  w = w.toLowerCase();
  if (w.endsWith('ing') && w.length > 5) return w.slice(0, -3);
  if (w.endsWith('ies') && w.length > 5) return w.slice(0, -3) + 'y';
  if (w.endsWith('ed') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('es') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
  if (w.endsWith('ion') && w.length > 5) return w.slice(0, -3);
  if (w.endsWith('ive') && w.length > 5) return w.slice(0, -3);
  if (w.endsWith('al') && w.length > 5) return w.slice(0, -2);
  return w;
}

class WSDEngine {
  constructor(options = {}) {
    this.useGemini = options.useGemini || false;
    this.geminiApiKey = options.geminiApiKey || '';
    this.geminiModel = options.geminiModel || 'gemini-flash-lite-latest';
  }

  /**
   * Test connection to Google Gemini API
   */
  async testGeminiConnection(apiKey, model = null) {
    const key = apiKey || this.geminiApiKey;
    const mdl = model || this.geminiModel || 'gemini-flash-lite-latest';
    if (!key) throw new Error('API key is empty');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${mdl}:generateContent?key=${key}`;
    const payload = {
      contents: [{ parts: [{ text: 'Ping' }] }]
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = (errData.error && errData.error.message) || `HTTP Error ${response.status}`;
      throw new Error(msg);
    }

    const data = await response.json();
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No candidate returned by Gemini');
    }
    return { success: true, model: mdl };
  }

  /**
   * Disambiguate a single polysemous token
   */
  async disambiguateToken(token) {
    if (!token.isPolysemous || !token.polyEntry) return token;

    if (this.useGemini && this.geminiApiKey) {
      try {
        await this.disambiguateBatchGemini([token]);
        return token;
      } catch (err) {
        console.warn('Gemini query failed, falling back to local semantic matcher:', err);
      }
    }

    // fallback to local semantic matcher based on context stems and collocations
    const match = this.localSemanticMatch(token);
    Object.assign(token, match);
    return token;
  }

  /**
   * High-speed batch disambiguation for multiple polysemous tokens via Gemini in 1 request
   */
  async disambiguateBatchGemini(polyTokens) {
    if (!polyTokens || polyTokens.length === 0) return polyTokens;
    if (!this.geminiApiKey) {
      polyTokens.forEach(t => this.localSemanticMatch(t));
      return polyTokens;
    }

    // build compact batch prompt with option 0 to prevent forced choices when no sense fits
    let prompt = `Pick the best sense index (1, 2, ...) for each target word in context. If NONE of the listed candidate senses fits the meaning in this sentence, choose 0:\n\n`;

    polyTokens.forEach((token, idx) => {
      const senses = token.polyEntry ? token.polyEntry.senses : [];
      prompt += `${idx + 1}. "${token.text}" in "${token.sentenceContext}"\n`;
      senses.forEach((s, sIdx) => {
        const defSnippet = s.definition.length > 75 ? s.definition.slice(0, 72) + '...' : s.definition;
        prompt += `[${sIdx + 1}] ${s.guideword || ''}: ${defSnippet}\n`;
      });
      prompt += `[0] NONE OF THE ABOVE (no listed sense fits this sentence)\n\n`;
    });

    prompt += `Return ONLY a JSON array of chosen integers (use 0 if none fit), e.g. [1, 0, 2]`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`;
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.0
        }
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Gemini API HTTP Error ${response.status}`);
      }

      const data = await response.json();
      const rawText = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] ? data.candidates[0].content.parts[0].text : '[]';
      
      let parsedIndices = [];
      try {
        const parsed = JSON.parse(rawText);
        if (Array.isArray(parsed)) {
          parsedIndices = parsed.map(item => {
            if (typeof item === 'number') return item;
            if (typeof item === 'string') return parseInt(item, 10);
            if (item && item.chosen_index !== undefined) return item.chosen_index;
            if (item && item.index !== undefined) return item.index;
            return parseInt(String(item), 10);
          });
        } else if (typeof parsed === 'number') {
          parsedIndices = [parsed];
        } else if (parsed && typeof parsed === 'object') {
          const arr = Object.values(parsed).find(v => Array.isArray(v)) || [Object.values(parsed)[0]];
          parsedIndices = arr.map(Number);
        }
      } catch (jsonErr) {
        // extract numbers if json parsing fails
        const matches = rawText.match(/\d+/g);
        if (matches) parsedIndices = matches.map(n => parseInt(n, 10));
      }

      polyTokens.forEach((token, idx) => {
        const chosenIdx = parsedIndices[idx];
        const senses = token.polyEntry ? token.polyEntry.senses : [];

        if (chosenIdx === 0) {
          // mark token unresolved when the model flags that no dictionary sense fits
          token.isUnresolved = true;
          token.selectedSense = null;
          token.cefr = 'Unresolved';
          token.confidence = 'AI Flagged (Missing Sense)';
          token.candidateSenses = senses;
          token.wsdMethod = `AI (${this.geminiModel})`;
          token.aiExplanation = `AI flagged this word: None of the ${senses.length} candidate senses in the dictionary inventory match this sentence context. Manual selection required.`;
        } else if (chosenIdx && senses[chosenIdx - 1]) {
          const chosen = senses[chosenIdx - 1];
          token.isUnresolved = false;
          token.cefr = chosen.cefr;
          token.selectedSense = chosen;
          token.confidence = '98% (AI)';
          token.candidateSenses = senses;
          token.wsdMethod = `AI (${this.geminiModel})`;
          token.aiExplanation = `Sense [${chosenIdx}] selected by AI: ${chosen.guideword} (${chosen.cefr}) - ${chosen.definition}`;
        } else {
          const fallback = this.localSemanticMatch(token);
          Object.assign(token, fallback);
        }
      });
    } catch (err) {
      console.warn('Gemini batch disambiguation failed, falling back to local semantic matcher:', err);
      polyTokens.forEach(token => {
        const fallback = this.localSemanticMatch(token);
        Object.assign(token, fallback);
      });
    }

    return polyTokens;
  }

  /**
   * Generates a contextual sense definition, guideword, and CEFR level via AI for a flagged word
   */
  async generateSenseAI(token) {
    if (!this.geminiApiKey) {
      throw new Error('No API key configured. Please configure your API key in Settings.');
    }

    const lemma = token.lemma || token.text;
    const sentence = token.sentenceContext || token.text;
    const senses = token.candidateSenses || (token.polyEntry ? token.polyEntry.senses : []);
    const sensesStr = senses.map((s, i) => `[${i + 1}] ${s.guideword || ''}: ${s.definition} (${s.cefr})`).join('\n');

    const prompt = `You are an expert computational linguist and CEFR vocabulary profiler.
The polysemous English word/phrase "${lemma}" appears in the sentence:
"${sentence}"

None of these existing dictionary senses fit this contextual usage:
${sensesStr || 'None listed'}

Analyze this word's exact contextual meaning in this sentence and deduce:
1. "cefr": The appropriate CEFR level (choose exactly one: A1, A2, B1, B2, C1, C2, or Off-list).
2. "guideword": A concise 1-3 word uppercase sense label / guideword (e.g. RELY ON, DIGITAL WALLET, METAPHOR).
3. "definition": A clear, pedagogical sense definition in simple English.

Respond ONLY with a JSON object in this exact schema:
{"cefr": "B2", "guideword": "...", "definition": "..."}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        response_mime_type: 'application/json',
        temperature: 0.1
      }
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`AI API HTTP Error ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.candidates && data.candidates[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error('No response generated by AI');

    const parsed = JSON.parse(rawText);
    return {
      cefr: parsed.cefr || 'B2',
      guideword: (parsed.guideword || 'CONTEXTUAL SENSE').toUpperCase(),
      definition: parsed.definition || 'Contextual word sense deduced from sentence.'
    };
  }

  /**
   * Enhanced Lemmatized & Stemmed Context Matcher
   */
  localSemanticMatch(token) {
    const rawContext = token.sentenceContext || "";
    const localContext = token.localWindow || rawContext;
    const candidateSenses = token.polyEntry.senses;

    // collect words from the wider sentence context
    const contextWords = rawContext
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && w !== token.lemma && w !== token.text.toLowerCase());

    const contextStems = new Set(contextWords.map(stemWord));

    // collect words within five positions on either side
    const localWords = localContext
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && w !== token.lemma && w !== token.text.toLowerCase());

    const localStems = new Set(localWords.map(stemWord));
    const localRawSet = new Set(localWords);

    // capture neighboring tokens for syntactic heuristics
    const prev = token.prevWord || '';
    const prev2 = token.prevWord2 || '';
    const next = token.nextWord || '';
    const next2 = token.nextWord2 || '';

    const SUBJECT_PRONOUNS = new Set(['i', 'you', 'he', 'she', 'it', 'we', 'they', 'who', 'whoever']);
    const AUX_MODALS = new Set([
      'to', 'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must', 
      'did', 'do', 'does', 'didnt', "didn't", 'dont', "don't", 'doesnt', "doesn't", 
      'cant', "can't", 'cannot', 'wont', "won't", 'shouldnt', "shouldn't", 'mustnt', "mustn't",
      'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being'
    ]);
    const OBJECT_REFLEXIVE_PRONOUNS = new Set([
      'me', 'him', 'us', 'them', 'myself', 'himself', 'herself', 'itself', 'ourselves', 'themselves', 'yourself', 'yourselves'
    ]);
    const DETERMINERS = new Set([
      'a', 'an', 'the', 'this', 'that', 'these', 'those', 'every', 'each', 'any', 'some', 'no', 'another'
    ]);
    const POSSESSIVES = new Set([
      'my', 'your', 'his', 'her', 'our', 'their', 'its', 'whose'
    ]);
    const PREPOSITIONS = new Set([
      'in', 'on', 'at', 'with', 'by', 'about', 'from', 'of', 'into', 'through', 'during', 'under', 'between', 'without', 'over'
    ]);
    const COMMON_ADJECTIVES = new Set([
      'favorite', 'favourite', 'good', 'bad', 'great', 'new', 'old', 'big', 'small', 'high', 'low', 
      'first', 'last', 'next', 'many', 'few', 'several', 'much', 'little', 'own', 'best', 'worst', 
      'real', 'true', 'right', 'wrong', 'full', 'long', 'short', 'important', 'beautiful', 'wonderful',
      'green', 'red', 'blue', 'black', 'white'
    ]);

    const isIng = token.text.toLowerCase().endsWith('ing') && token.text.length > 4;
    const isEd = (token.text.toLowerCase().endsWith('ed') || token.text.toLowerCase().endsWith('d')) && token.text.length > 4;

    let syntacticPOS = null;
    let posStrength = 0;

    // fixed lexical collocations and phrase anchors
    if (token.lemma === 'while') {
      if (prev === 'a' || prev === 'the' || (prev2 === 'for' && prev === 'a')) {
        syntacticPOS = 'noun';
        posStrength = 35; // phrases like for a while
      } else {
        syntacticPOS = 'conjunction';
        posStrength = 35; // clauses like while watching
      }
    } else if (token.lemma === 'make' && (next === 'sure' || next === 'certain')) {
      syntacticPOS = 'verb';
      posStrength = 40; // phrases like make sure
    } else if (token.lemma === 'watch') {
      if (next === 'over' || next === 'out') {
        syntacticPOS = 'verb';
        posStrength = 40; // "watch over", "watch out"
      } else if (prev === 'keep' || prev === 'kept' || prev === 'on') {
        syntacticPOS = 'noun';
        posStrength = 40; // "keep watch", "on watch"
      } else if (POSSESSIVES.has(prev) || DETERMINERS.has(prev)) {
        syntacticPOS = 'noun';
        posStrength = 35; // "my watch", "a watch"
      } else if (SUBJECT_PRONOUNS.has(prev) || AUX_MODALS.has(prev) || prev === 'to') {
        syntacticPOS = 'verb';
        posStrength = 35; // "I watched", "to watch"
      }
    } else if (token.lemma === 'look') {
      if ((prev === 'a' || prev === 'the') && (prev2 === 'take' || prev2 === 'have')) {
        syntacticPOS = 'noun';
        posStrength = 45; // "take a look", "have a look" -> GLANCE (A2)
      } else if (next === 'for' || next === 'around' || (next === 'in' && (localRawSet.has('places') || localRawSet.has('place') || localRawSet.has('different') || localRawSet.has('nearby') || localRawSet.has('everywhere') || localRawSet.has('room') || localRawSet.has('drawers')))) {
        syntacticPOS = 'verb';
        posStrength = 40; // "look for", "look around", "look in different places" -> SEARCH (A2)
      } else if (next === 'after') {
        syntacticPOS = 'verb';
        posStrength = 40; // "look after" -> TAKE CARE (A2)
      } else if (next === 'into') {
        syntacticPOS = 'verb';
        posStrength = 40; // "look into" -> INVESTIGATE (B2)
      } else if (next === 'at') {
        syntacticPOS = 'verb';
        posStrength = 40; // "look at", "looked at" -> DIRECT EYES (A1)
      } else if (prev === 'have' || prev === 'take' || DETERMINERS.has(prev) || POSSESSIVES.has(prev)) {
        syntacticPOS = 'noun';
        posStrength = 35; // "have a look", "take a look" -> GLANCE (A2)
      }
    } else if (token.lemma === 'figure') {
      if (next === 'out') {
        syntacticPOS = 'verb';
        posStrength = 40; // "figure out" -> B1 (SOLVE / UNDERSTAND)
      } else if (prev === 'a' || prev === 'the' || POSSESSIVES.has(prev)) {
        syntacticPOS = 'noun';
        posStrength = 35; // "a figure", "sales figure"
      }
    } else if (token.lemma === 'later') {
      if (next && (next === 'years' || next === 'stages' || next === 'date' || next === 'editions' || next === 'life')) {
        syntacticPOS = 'adjective';
        posStrength = 35;
      } else {
        syntacticPOS = 'adverb';
        posStrength = 35; // e.g. "Later, my father...", "see you later"
      }
    } else if (token.lemma === 'before') {
      if (next && (next.endsWith('ing') || DETERMINERS.has(next) || POSSESSIVES.has(next) || next === 'school' || next === 'lunch' || next === 'dinner')) {
        syntacticPOS = 'preposition';
        posStrength = 35; // e.g. "before leaving for school"
      } else if (!next) {
        syntacticPOS = 'adverb';
        posStrength = 30; // e.g. "I have seen this before"
      }
    }

    // use part of speech from the pos tagger if available
    if (!syntacticPOS && token.posTag) {
      if (token.posTag === 'VERB') {
        syntacticPOS = 'verb';
        posStrength = 35;
      } else if (token.posTag === 'NOUN') {
        syntacticPOS = 'noun';
        posStrength = 35;
      } else if (token.posTag === 'ADJ') {
        syntacticPOS = 'adjective';
        posStrength = 30;
      } else if (token.posTag === 'ADV') {
        syntacticPOS = 'adverb';
        posStrength = 30;
      }
    }

    // fall back to adjacent syntactic cues
    if (!syntacticPOS) {
      if (SUBJECT_PRONOUNS.has(prev) || (AUX_MODALS.has(prev) && prev !== 'to') || prev === 'to') {
        syntacticPOS = 'verb';
        posStrength = 25;
      } else if (OBJECT_REFLEXIVE_PRONOUNS.has(next)) {
        syntacticPOS = 'verb';
        posStrength = 20;
      } else if (isIng && !DETERMINERS.has(prev) && !POSSESSIVES.has(prev)) {
        // participle or gerund structures like birds flying or making sure
        syntacticPOS = 'verb';
        posStrength = 30;
      } else if (isEd && !DETERMINERS.has(prev) && !POSSESSIVES.has(prev)) {
        // past verb forms like watched or booked
        syntacticPOS = 'verb';
        posStrength = 25;
      } else if (DETERMINERS.has(prev) || POSSESSIVES.has(prev) || prev.endsWith("'s")) {
        syntacticPOS = 'noun';
        posStrength = 25;
      } else if ((DETERMINERS.has(prev2) || POSSESSIVES.has(prev2)) && COMMON_ADJECTIVES.has(prev)) {
        syntacticPOS = 'noun';
        posStrength = 30; // adjective noun sequences like the green plant
      } else if (COMMON_ADJECTIVES.has(prev) && !SUBJECT_PRONOUNS.has(prev2)) {
        syntacticPOS = 'noun';
        posStrength = 20;
      } else if (PREPOSITIONS.has(prev) && prev !== 'to' && !SUBJECT_PRONOUNS.has(next)) {
        syntacticPOS = 'noun';
        posStrength = 15;
      }
    }

    let bestSense = candidateSenses[0];
    let maxScore = -999;
    const scoredSenses = [];

    for (const sense of candidateSenses) {
      let score = 0;

      // match dictionary keywords, weighting local neighbors over distant context
      if (sense.keywords) {
        for (const kw of sense.keywords) {
          const kwLower = kw.toLowerCase();
          const kwStem = stemWord(kwLower);

          if (localRawSet.has(kwLower) || localStems.has(kwStem)) {
            score += 10; // immediate local collocation
          } else if (contextStems.has(kwStem)) {
            score += 3;  // distant sentence context
          }
        }
      }

      // check stem overlap against the sense definition
      if (sense.definition) {
        const defWords = sense.definition
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length > 3);

        for (const dw of defWords) {
          const ds = stemWord(dw);
          if (localStems.has(ds)) {
            score += 4;
          } else if (contextStems.has(ds)) {
            score += 1.5;
          }
        }
      }

      // check stem overlap against example sentences
      if (sense.examples) {
        for (const ex of sense.examples) {
          const exWords = ex
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 3);

          for (const ew of exWords) {
            const es = stemWord(ew);
            if (localStems.has(es)) {
              score += 2;
            }
          }
        }
      }

      // reward senses matching the predicted part of speech
      const sensePOS = (sense.pos || (sense.guideword ? sense.guideword.split('/')[0].trim().toLowerCase() : '')).toLowerCase();
      if (syntacticPOS && sensePOS) {
        if (sensePOS.includes(syntacticPOS) || (syntacticPOS === 'verb' && sensePOS.startsWith('verb')) || (syntacticPOS === 'noun' && sensePOS.startsWith('noun')) || (syntacticPOS === 'conjunction' && sensePOS.startsWith('conj')) || (syntacticPOS === 'preposition' && sensePOS.startsWith('prep')) || (syntacticPOS === 'adverb' && sensePOS.startsWith('adv'))) {
          score += posStrength;
        } else if ((syntacticPOS === 'verb' && sensePOS.startsWith('noun')) || (syntacticPOS === 'noun' && sensePOS.startsWith('verb')) || (syntacticPOS === 'conjunction' && sensePOS.startsWith('noun')) || (syntacticPOS === 'adverb' && sensePOS.startsWith('adj')) || (syntacticPOS === 'preposition' && sensePOS.startsWith('adv'))) {
          score -= posStrength;
        }
      }

      // apply bonuses for recognized phrasal collocations
      if (token.lemma === 'look') {
        if ((prev === 'a' || prev === 'the') && (prev2 === 'take' || prev2 === 'have') && sense.id === 'look_a2_noun') score += 50;
        else if ((next === 'for' || next === 'around' || (next === 'in' && (localRawSet.has('places') || localRawSet.has('place') || localRawSet.has('different') || localRawSet.has('nearby')))) && sense.id === 'look_a2_search') score += 45;
        else if (next === 'after' && sense.id === 'look_a2_care') score += 40;
        else if (next === 'into' && sense.id === 'look_b2_investigate') score += 40;
        else if (next === 'at' && sense.id === 'look_a1_direct') score += 40;
      }
      if (token.lemma === 'figure') {
        if (next === 'out' && (sense.id === 'figure_b1_phrasal' || sense.id.includes('phrasal'))) score += 50;
      }
      if (token.lemma === 'watch') {
        if (next === 'over' && sense.id === 'watch_b2_phrasal') score += 40;
        else if ((prev === 'keep' || prev === 'kept' || prev === 'on') && sense.id === 'watch_b2_noun') score += 40;
        else if ((POSSESSIVES.has(prev) || DETERMINERS.has(prev)) && sense.id === 'watch_a1_noun') score += 40;
      }
      if (token.lemma === 'light') {
        if (localRawSet.has('tunnel') && (sense.id === 'light_b2_tunnel' || sense.guideword.includes('TUNNEL') || sense.guideword.includes('HOPE'))) {
          score += 50;
        } else if ((token.posTag === 'VERB' || syntacticPOS === 'verb' || localRawSet.has('candle') || localRawSet.has('fire') || localRawSet.has('match') || prev === 'to') && (sense.id === 'light_a2_burn' || sense.pos === 'verb')) {
          score += 50;
        } else if ((token.posTag === 'ADJ' || syntacticPOS === 'adjective' || next === 'touch' || localRawSet.has('touch') || localRawSet.has('delicate')) && (sense.id === 'light_b1_gentle' || sense.guideword.includes('GENTLE') || sense.guideword.includes('TOUCH'))) {
          score += 50;
        } else if ((token.posTag === 'NOUN' || syntacticPOS === 'noun') && (localRawSet.has('sun') || localRawSet.has('shine') || localRawSet.has('window') || localRawSet.has('dark')) && (sense.id === 'light_a1_sun' || sense.guideword.includes('NATURAL') || sense.guideword.includes('ENERGY') || sense.guideword.includes('SUN'))) {
          score += 50;
        }
      }
      if (token.lemma === 'color' || token.lemma === 'colour') {
        if ((token.posTag === 'NOUN' || syntacticPOS === 'noun' || localRawSet.has('artist') || localRawSet.has('painting') || localRawSet.has('delicate') || localRawSet.has('shade')) && (sense.id === 'color_a1_hue' || sense.guideword.includes('HUE') || sense.guideword.includes('PIGMENT'))) {
          score += 50;
        }
      }
      if (token.lemma === 'see') {
        if ((token.posTag === 'VERB' || syntacticPOS === 'verb' || token.text.toLowerCase() === 'saw') && (localRawSet.has('light') || localRawSet.has('eyes') || localRawSet.has('sight') || localRawSet.has('tunnel') || !syntacticPOS) && (sense.id === 'see_a1_sight' || sense.guideword.includes('SIGHT') || sense.guideword.includes('PERCEIVE'))) {
          score += 45;
        }
      }
      if (token.lemma === 'bank') {
        if ((next === 'on' || token.isPhrasal) && (sense.id.includes('phrasal') || (sense.guideword && sense.guideword.includes('RELY')))) {
          score += 55;
        } else if (localRawSet.has('river') || localRawSet.has('water') || localRawSet.has('stream') || localRawSet.has('lake') || localRawSet.has('birds') || localRawSet.has('fish') || next === 'of') {
          if (sense.id === 'bank_b1' || (sense.guideword && sense.guideword.includes('RIVERBANK'))) score += 45;
        } else if (localRawSet.has('money') || localRawSet.has('withdraw') || localRawSet.has('deposit') || localRawSet.has('cash') || localRawSet.has('loan') || localRawSet.has('account')) {
          if (sense.id === 'bank_a1' || (sense.guideword && sense.guideword.includes('FINANCIAL'))) score += 45;
        }
      }
      if (token.isPhrasal && token.phrasalVerb) {
        if (sense.id && sense.id.includes(token.phrasalVerb.replace(/\s+/g, '_'))) {
          score += 35;
        }
      }

      scoredSenses.push({ sense, score });
      if (score > maxScore) {
        maxScore = score;
        bestSense = sense;
      }
    }

    // calculate match confidence and handle fallback tie breaking
    const positiveScores = scoredSenses.map(s => Math.max(0, s.score));
    const totalPositiveScore = positiveScores.reduce((acc, curr) => acc + curr, 0);
    let confidenceLabel;

    if (maxScore > 0 && totalPositiveScore > 0) {
      const ratio = Math.max(0, maxScore) / totalPositiveScore;
      const confidence = Math.min(0.98, Math.max(0.68, ratio + 0.15));
      confidenceLabel = `${Math.round(confidence * 100)}% (Context Match)`;
    } else {
      if (maxScore <= 0) {
        const CEFR_RANKS = { 'A1': 1, 'A2': 2, 'B1': 3, 'B2': 4, 'C1': 5, 'C2': 6 };
        const sortedPrior = [...candidateSenses].sort((a, b) => {
          return (CEFR_RANKS[a.cefr] || 99) - (CEFR_RANKS[b.cefr] || 99);
        });
        bestSense = sortedPrior[0];
      }
      confidenceLabel = `40% (Uncertain - Baseline Prior)`;
    }

    token.cefr = bestSense.cefr;
    token.selectedSense = bestSense;
    token.confidence = confidenceLabel;
    token.candidateSenses = candidateSenses;
    token.wsdMethod = 'Stemmed Semantic Matcher';

    return token;
  }

}

if (typeof window !== 'undefined') window.WSDEngine = WSDEngine;
if (typeof globalThis !== 'undefined') globalThis.WSDEngine = WSDEngine;
if (typeof module !== 'undefined' && module.exports) module.exports = { WSDEngine };
