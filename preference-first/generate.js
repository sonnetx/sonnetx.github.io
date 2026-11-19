/* Build a decision in the browser from a description, PubMed abstracts, and the reader's own API key.
   A rate is scored only when its quote appears in the abstract and the number appears in the quote. */
(function () {
  const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  const NUMBER = /(?<![\w.])(\d+(?:\.\d+)?)(?![\w.])/g;

  function normalize(text) {
    return String(text)
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/[\u2009\u00a0\u2002\u2003]/g, ' ')
      .replace(/[\u2212\u2013\u2014]/g, '-')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function numbersIn(text) {
    return [...normalize(text).matchAll(NUMBER)].map(m => Number(m[1]));
  }
  function textOf(node) {
    return normalize(node ? node.textContent : '');
  }

  const FRAME_SCHEMA = {
    type: 'object',
    properties: {
      id: { type: 'string' },
      title: { type: 'string' },
      question: { type: 'string' },
      context: { type: 'string' },
      population: { type: 'string' },
      options: {
        type: 'array',
        items: {
          type: 'object',
          properties: { id: { type: 'string' }, name: { type: 'string' }, short: { type: 'string' }, burden: { type: 'string' } },
          required: ['id', 'name', 'short', 'burden'],
        },
      },
      outcomes: {
        type: 'array',
        items: {
          type: 'object',
          properties: { id: { type: 'string' }, name: { type: 'string' }, plain: { type: 'string' }, description: { type: 'string' } },
          required: ['id', 'name', 'plain', 'description'],
        },
      },
      queries: { type: 'array', items: { type: 'string' } },
    },
    required: ['id', 'title', 'question', 'context', 'population', 'options', 'outcomes', 'queries'],
  };

  function extractSchema(optionIds, outcomeIds) {
    return {
      type: 'object',
      properties: {
        claims: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              outcome_id: { type: 'string', enum: outcomeIds },
              option_id: { type: 'string', enum: optionIds },
              kind: { type: 'string', enum: ['rate', 'qualitative'] },
              value: { type: ['number', 'null'] },
              complement: { type: 'boolean' },
              timepoint: { type: 'string' },
              quote: { type: 'string' },
              level: { type: ['string', 'null'] },
            },
            required: ['outcome_id', 'option_id', 'kind', 'value', 'complement', 'timepoint', 'quote', 'level'],
          },
        },
      },
      required: ['claims'],
    };
  }

  function framePrompt(problem) {
    return (
      'A person has described a medical situation in which they face a choice. Frame the decision so it can be compared using trial evidence weighed by what matters to them.\n\n' +
      'Rules:\n' +
      '1. Options: only approaches a clinician would actually offer for this situation. Two to four. Include a conservative or waiting option when that is a real alternative, and leave out anything that would not be on the table.\n' +
      '2. Outcomes: five to eight harms a trial would count, each stated so that lower is better. Include a time horizon in the plain wording.\n' +
      '3. Queries: PubMed searches likely to find the randomized trials comparing these options, including trial names if you know them.\n' +
      '4. Write in plain sentences. Do not recommend anything.\n\n' +
      'Description:\n' + problem
    );
  }
  function handoutPrompt(text) {
    return (
      'A person uploaded a handout from their doctor. Frame the decision from that handout alone.\n\n' +
      'Rules:\n' +
      '1. Options: only the treatments the handout offers as choices. Two to four. Use the handout\'s own names. Do not add a treatment the handout does not mention, and do not drop one it presents as a real option.\n' +
      '2. Outcomes: the harms the handout actually discusses, stated so that lower is better. Prefer outcomes for which the handout prints a number.\n' +
      '3. context: two or three sentences describing this person\'s situation, in words a reader can edit. Stay inside what the handout says.\n' +
      '4. queries: an empty list.\n' +
      '5. Do not recommend anything.\n\n' +
      'Handout:\n' + text.slice(0, 14000)
    );
  }
  function extractPrompt(frame, doc) {
    const options = frame.options.map(o => `- ${o.id}: ${o.name}`).join('\n');
    const outcomes = frame.outcomes.map(o => `- ${o.id}: avoiding ${o.plain}`).join('\n');
    return (
      'Read the source and list every claim that gives, for one listed option, a rate for one listed outcome, or a qualitative comparison when no number is printed.\n\n' +
      'Rules the verifier will enforce:\n' +
      '1. quote must be copied verbatim from the source, including the number.\n' +
      '2. value is the rate per 100 people as the number appears in the quote. If the quote reports the good outcome, set complement true and value to 100 minus that number.\n' +
      '3. Use only ids from the lists.\n' +
      '4. Include the timepoint.\n' +
      '5. If the source compares options only in words, record a qualitative claim with a short level and a verbatim quote.\n\n' +
      `Options:\n${options}\n\nOutcomes:\n${outcomes}\n\nSource ${doc.id} (${doc.citation}):\n${doc.text}`
    );
  }

  async function ask(key, model, prompt, schema) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 8000,
        tools: [{ name: 'record', description: 'Record the structured result.', input_schema: schema }],
        tool_choice: { type: 'tool', name: 'record' },
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.error?.message || res.statusText || 'request failed';
      throw new Error(msg);
    }
    const tool = (data.content || []).find(b => b.type === 'tool_use');
    if (!tool) throw new Error(data.stop_reason === 'refusal' ? 'The model declined.' : 'The model returned no structured result.');
    return tool.input;
  }

  async function searchPubmed(query) {
    const url = `${EUTILS}/esearch.fcgi?db=pubmed&retmode=json&retmax=4&sort=relevance&tool=preference-first&email=sonnet@stanford.edu&term=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('PubMed search failed (' + res.status + ').');
    const data = await res.json();
    return data.esearchresult?.idlist || [];
  }
  async function fetchPubmed(pmids) {
    if (!pmids.length) return [];
    const url = `${EUTILS}/efetch.fcgi?db=pubmed&retmode=xml&rettype=abstract&tool=preference-first&email=sonnet@stanford.edu&id=${pmids.join(',')}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('PubMed fetch failed (' + res.status + ').');
    const xml = new DOMParser().parseFromString(await res.text(), 'text/xml');
    const docs = [];
    for (const art of xml.querySelectorAll('PubmedArticle')) {
      const pmid = textOf(art.querySelector('PMID'));
      const title = textOf(art.querySelector('ArticleTitle'));
      const parts = [...art.querySelectorAll('Abstract AbstractText')].map(node => {
        const label = node.getAttribute('Label');
        const body = textOf(node);
        return label ? `${label}: ${body}` : body;
      });
      const authors = [...art.querySelectorAll('AuthorList > Author')].map(a => {
        const last = textOf(a.querySelector('LastName'));
        const init = textOf(a.querySelector('Initials'));
        return last ? `${last} ${init}`.trim() : '';
      }).filter(Boolean);
      const journal = textOf(art.querySelector('Journal ISOAbbreviation')) || textOf(art.querySelector('Journal Title'));
      const year = textOf(art.querySelector('PubDate Year')) || textOf(art.querySelector('ArticleDate Year'));
      const first = authors[0] || 'Unknown';
      const citation = [first + (authors.length > 1 ? ' et al' : ''), title, `${journal} ${year}`.trim()].filter(Boolean).join('. ') + '.';
      docs.push({ id: 'pmid:' + pmid, title, text: normalize(title + ' ' + parts.join(' ')), citation, url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` });
    }
    return docs;
  }

  function verify(claim, doc) {
    const quote = normalize(claim.quote || '');
    if (!doc) return 'unknown source';
    if (quote.length < 8) return 'quote too short';
    if (!doc.text.includes(quote)) return 'quote not found verbatim in the abstract';
    if (claim.kind === 'qualitative') return claim.level ? '' : 'qualitative claim without a level';
    const value = Number(claim.value);
    if (!Number.isFinite(value) || value < 0 || value > 100) return 'value is not a rate per 100';
    const printed = claim.complement ? 100 - value : value;
    if (!numbersIn(quote).some(n => Math.abs(n - printed) < 1e-9)) return `number ${printed} does not appear in the quote`;
    return '';
  }

  function horizon(claim) {
    const nums = numbersIn(claim.timepoint || '');
    if (!nums.length) return 0;
    return /month/i.test(claim.timepoint) ? nums[0] / 12 : nums[0];
  }
  function pick(claims) {
    return [...claims].sort((a, b) => horizon(b) - horizon(a))[0];
  }

  function assemble(frame, claims, docs) {
    const optionIds = frame.options.map(o => o.id);
    const attributes = [];
    const scored = [], unscored = [], dropped = [];
    for (const oc of frame.outcomes) {
      const mine = claims.filter(c => c.outcome_id === oc.id && c.ok);
      const rates = Object.fromEntries(optionIds.map(id => [id, mine.filter(c => c.option_id === id && c.kind === 'rate')]));
      const quals = Object.fromEntries(optionIds.map(id => [id, mine.filter(c => c.option_id === id && c.kind === 'qualitative')]));
      const cite = [...new Set(mine.map(c => docs[c.source_id]?.citation).filter(Boolean))].join('; ');
      if (optionIds.every(id => rates[id].length)) {
        const chosen = Object.fromEntries(optionIds.map(id => [id, pick(rates[id])]));
        const times = [...new Set(Object.values(chosen).map(c => c.timepoint).filter(Boolean))];
        attributes.push({
          id: oc.id, name: oc.name, plain: oc.plain, kind: 'rate', direction: 'lower_is_better', category: 'disease',
          unit: 'out of 100 people' + (times.length === 1 ? ` at ${times[0]}` : ''),
          values: Object.fromEntries(optionIds.map(id => [id, chosen[id].value])),
          levels: {}, note: oc.description, source: cite,
          evidence: Object.values(chosen).map(c => ({ ...c, status: 'verified' })),
        });
        scored.push(oc.id);
      } else if (mine.length) {
        const levels = {};
        for (const id of optionIds) {
          if (rates[id].length) { const c = pick(rates[id]); levels[id] = `${c.value} in 100 at ${c.timepoint || 'the reported time'}`; }
          else if (quals[id].length) levels[id] = quals[id][0].level || 'reported';
          else levels[id] = 'not reported';
        }
        attributes.push({
          id: oc.id, name: oc.name, plain: oc.plain, kind: 'ordinal', direction: 'lower_is_better', category: 'function',
          unit: 'as reported, not scored because a comparable number was not verified for every option',
          values: {}, levels, source: cite,
          note: oc.description + ' Shown in words and not scored.',
          evidence: mine.map(c => ({ ...c, status: 'verified' })),
        });
        unscored.push(oc.id);
      } else dropped.push(oc.name);
    }
    const verifiedDocs = [...new Set(claims.filter(c => c.ok).map(c => c.source_id))];
    return {
      decision: {
        id: String(frame.id || 'custom').replace(/[^a-z0-9_]+/gi, '_').toLowerCase().slice(0, 40) || 'custom',
        title: frame.title, question: frame.question, context: frame.context, population: frame.population,
        options: frame.options, attributes,
        tradeoff_checks: [],
        default_weights_note: 'Before your values are recorded, the comparison treats every outcome as mattering equally. That is not a recommendation. It is the placeholder your answers replace.',
        sources: verifiedDocs.map(id => docs[id]?.citation).filter(Boolean),
        provenance: { built_in: 'browser', scored, unscored, dropped },
      },
      scored, dropped,
    };
  }

  async function buildFromDescription(problem, key, model, onStatus) {
    const say = onStatus || (() => {});
    say('Framing the decision.');
    const frame = await ask(key, model, framePrompt(problem), FRAME_SCHEMA);
    if (!frame.options || frame.options.length < 2) throw new Error('The model did not return two options.');
    if (!frame.outcomes || frame.outcomes.length < 2) throw new Error('The model did not return outcomes.');
    const ids = [];
    say('Searching PubMed.');
    for (const q of (frame.queries || []).slice(0, 4)) {
      for (const id of await searchPubmed(q)) if (!ids.includes(id)) ids.push(id);
      if (ids.length >= 5) break;
    }
    const pmids = ids.slice(0, 5);
    if (!pmids.length) throw new Error('PubMed returned no papers for this description.');
    say(`Reading ${pmids.length} abstracts.`);
    const docs = await fetchPubmed(pmids);
    const byId = Object.fromEntries(docs.map(d => [d.id, d]));
    const optionIds = frame.options.map(o => o.id);
    const outcomeIds = frame.outcomes.map(o => o.id);
    const schema = extractSchema(optionIds, outcomeIds);
    const claims = [];
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      say(`Checking abstract ${i + 1} of ${docs.length}.`);
      let extracted;
      try { extracted = await ask(key, model, extractPrompt(frame, doc), schema); }
      catch (e) { claims.push({ ok: false, reason: e.message, source_id: doc.id, quote: '' }); continue; }
      for (const c of extracted.claims || []) {
        const reason = verify({ ...c, source_id: doc.id }, doc);
        claims.push({ ...c, source_id: doc.id, value: c.kind === 'rate' ? Number(c.value) : c.value, ok: !reason, reason });
      }
    }
    const built = assemble(frame, claims, byId);
    const rejected = claims.filter(c => !c.ok).length;
    built.rejected = rejected;
    built.checked = docs.length;
    if (built.scored.length < 1) {
      const err = new Error(`None of the ${docs.length} abstracts produced a rate that covered every option. ${rejected} claims were rejected because the quote or the number was not in the abstract. Abstracts often omit the tables, so a preset decision may be the better source.`);
      err.partial = built.decision;
      throw err;
    }
    return built;
  }

  function handoutMentions(text, name) {
    const hay = normalize(text).toLowerCase();
    const words = String(name).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3);
    return words.some(w => hay.includes(w));
  }

  async function buildFromHandout(text, key, model, onStatus) {
    const say = onStatus || (() => {});
    const handout = String(text || '').trim();
    if (handout.length < 40) throw new Error('Paste more of the handout. A few words is not enough to read the options.');
    say('Reading the handout.');
    const frame = await ask(key, model, handoutPrompt(handout), FRAME_SCHEMA);
    frame.options = (frame.options || []).filter(o => handoutMentions(handout, o.name));
    if (frame.options.length < 2) throw new Error('The handout does not name two treatments. Edit the description yourself, and uncheck any option your doctor did not offer.');
    if (!frame.outcomes || frame.outcomes.length < 1) throw new Error('The handout does not describe outcomes with numbers. The description now uses your handout, and the trial rates stay in the table.');
    frame.queries = [];
    const doc = { id: 'handout', title: 'Clinic handout', text: normalize(handout), citation: 'Handout from the clinic, as uploaded.', url: '' };
    const schema = extractSchema(frame.options.map(o => o.id), (frame.outcomes || []).map(o => o.id));
    say('Checking that each number is written in the handout.');
    let extracted;
    try { extracted = await ask(key, model, extractPrompt(frame, doc), schema); }
    catch (e) { throw new Error(e.message || 'Could not read the handout.'); }
    const claims = [];
    for (const c of extracted.claims || []) {
      const reason = verify({ ...c, source_id: doc.id }, doc);
      claims.push({ ...c, source_id: doc.id, value: c.kind === 'rate' ? Number(c.value) : c.value, ok: !reason, reason });
    }
    const built = assemble(frame, claims, { [doc.id]: doc });
    built.rejected = claims.filter(c => !c.ok).length;
    built.checked = 1;
    if (built.scored.length < 1) {
      throw new Error('The handout names the options, but it does not give a number for each of them. The description now uses your handout. The trial rates stay in the table, and you can uncheck any option that was not offered.');
    }
    return built;
  }

  window.buildFromDescription = buildFromDescription;
  window.buildFromHandout = buildFromHandout;
})();
