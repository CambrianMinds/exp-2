/**
 * Standalone MyCase Parsing Functions for Canary Testing
 * 
 * Directly mirrors the bookmarklet and extension parsing logic
 * to parse DOM HTML and CCS JSON payloads.
 */

function cleanHtml(text) {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function cleanCharges(charges) {
  if (!charges) return '';
  let clean = charges.replace(/\*{3}\s*REFERENCE CCS ENTRY\s*\*{3}/gi, '').trim();
  clean = clean.replace(/\s+/g, ' ').trim();
  return clean;
}

function parseCCSJson(json) {
  const ccsData = {
    charges: [],
    docketEntries: [],
    financialSummary: null,
    arrestingAgency: null,
    sentenceDetails: null,
    dispositionDate: ''
  };

  if (Array.isArray(json.Charges)) {
    json.Charges.forEach(charge => {
      let offense = charge.OffenseDescription || '';

      if (offense.toUpperCase().includes('SEE CCS ENTRY') && Array.isArray(json.Events)) {
        const chargeNum = charge.ChargeNumber || '01';

        for (const evt of json.Events) {
          if (evt.CaseEvent && evt.CaseEvent.Comment) {
            const comment = evt.CaseEvent.Comment;
            const pat = new RegExp('COUNT\\s*' + chargeNum + '\\s+(.+?)(?:\\s*\\(RJO|\\s*\\||$)', 'i');
            const m = comment.match(pat);
            if (m) {
              offense = m[1].trim();
              break;
            }
          }
        }

        if (offense.toUpperCase().includes('SEE CCS ENTRY')) {
          for (const evt of json.Events) {
            if (evt.CaseEvent && evt.CaseEvent.Comment) {
              const comment = evt.CaseEvent.Comment;
              const m = comment.match(/COUNT\s*\d+\s+(.+?)(?:\s*\(RJO|\s*\||$)/i);
              if (m) {
                offense = m[1].trim();
                break;
              }
            }
          }
        }
      }

      ccsData.charges.push({
        count: charge.ChargeNumber || '',
        offense: offense,
        statute: charge.OffenseStatute || '',
        level: charge.OffenseDegree || '',
        disposition: '',
        dispositionDate: ''
      });
    });
  }

  if (Array.isArray(json.Events)) {
    json.Events.forEach(evt => {
      if (evt.DispEvent) {
        if (evt.EventDate && !ccsData.dispositionDate) {
          ccsData.dispositionDate = evt.EventDate;
        }
        if (Array.isArray(evt.DispEvent.Charges)) {
          evt.DispEvent.Charges.forEach(dc => {
            const match = ccsData.charges.find(c => c.count === dc.ChargeNumber);
            if (match) {
              if (dc.DispositionType) match.disposition = dc.DispositionType;
              if (evt.EventDate && !match.dispositionDate) match.dispositionDate = evt.EventDate;
            }
          });
        }
      }
    });
  }

  if (Array.isArray(json.Events)) {
    json.Events.forEach(evt => {
      ccsData.docketEntries.push({
        date: evt.EventDate || '',
        type: evt.EventType || '',
        description: evt.Description || '',
        text: evt.CaseEvent ? evt.CaseEvent.Comment || '' : ''
      });
    });
  }

  if (Array.isArray(json.Parties)) {
    const defendant = json.Parties.find(p => p.BaseConnKey === 'DF');
    if (defendant && defendant.FeeSummary) {
      ccsData.financialSummary = {
        balance: defendant.FeeSummary.Balance || 'N/A',
        asOf: defendant.FeeSummary.AsOf || '',
        categories: defendant.FeeSummary.Categories || []
      };
    }
  }

  return ccsData;
}

module.exports = {
  cleanHtml,
  cleanCharges,
  parseCCSJson
};
