class DoricoFixer {
  constructor() {}

  fix(xmlContent) {
    let fixed = xmlContent;
    fixed = this.p_clef_fix(fixed);
    fixed = this.ghost_note_fix(fixed);
    fixed = this.crash_notehead_fix(fixed);
    fixed = this.hihat_notehead_fix(fixed);

    //For old format
    fixed = this.word_to_rehearsal(fixed, {
      "font-family": "Times New Roman",
      "font-size": "12",
      "font-weight": "bold",
    });
    //For new format
    fixed = this.word_to_rehearsal(fixed, {
      "font-family": "Arial",
      "font-size": "10",
      "font-weight": "bold",
    });

    fixed = this.placement_change(
      fixed,
      {
        "font-family": "Times New Roman",
      },
      "below"
    );

    fixed = this.bpm_remover(fixed);

    fixed = this.midi_fix(fixed);

    return fixed;
  }

  p_clef_fix(xml) {
    const partStart = xml.indexOf('<part id="P1"');
    if (partStart === -1) return xml;

    const partEnd = xml.indexOf("</part>", partStart);
    const partContent = xml.substring(partStart, partEnd);

    const measureMatch = partContent.match(
      /<measure[^>]*number=["']1["'][^>]*>([\s\S]*?)<\/measure>/
    );
    if (!measureMatch) return xml;

    const measureContent = measureMatch[0];
    const attributesMatch = measureContent.match(
      /<attributes>([\s\S]*?)<\/attributes>/
    );
    const clefRegex =
      /<clef[^>]*print-object=['"]no['"][^>]*>\s*<sign>percussion<\/sign>\s*<\/clef>/;

    let updatedMeasure = measureContent;

    if (attributesMatch) {
      const attributesContent = attributesMatch[0];

      if (!clefRegex.test(attributesContent)) {
        const newClef = `  <clef print-object="no">\n    <sign>percussion</sign>\n  </clef>\n`;
        const insertionPoint = attributesContent.lastIndexOf("</attributes>");
        const newAttributes = attributesContent.replace(
          "</attributes>",
          `${newClef}</attributes>`
        );
        updatedMeasure = measureContent.replace(
          attributesContent,
          newAttributes
        );
      }
    } else {
      // no <attributes> — create one and add clef
      const newAttributesBlock = `  <attributes>\n    <clef print-object="no">\n      <sign>percussion</sign>\n    </clef>\n  </attributes>\n`;
      updatedMeasure = measureContent.replace(
        /<measure[^>]*>/,
        (match) => `${match}\n${newAttributesBlock}`
      );
    }

    return xml.replace(measureContent, updatedMeasure);
  }

  find_instrument_id(xml, instrument_name) {
    const scorePartMatch = xml.match(
      /<score-part id="P1">([\s\S]*?)<\/score-part>/
    );
    if (!scorePartMatch) return null;

    const partContent = scorePartMatch[1];
    const regex =
      /<score-instrument id="([^"]+)">([\s\S]*?)<\/score-instrument>/g;
    let match;

    while ((match = regex.exec(partContent)) !== null) {
      const id = match[1];
      const content = match[2];
      const nameMatch = content.match(
        /<instrument-name>(.*?)<\/instrument-name>/
      );
      if (nameMatch && nameMatch[1].trim() === instrument_name) {
        return id;
      }
    }

    return null;
  }

  add_in_instrument(xml, instrument_id, codeToAdd) {
    const partMatch = xml.match(/<part id="P1">([\s\S]*?)<\/part>/);
    if (!partMatch) return xml;

    const originalPart = partMatch[0];
    let newPart = originalPart;

    const noteRegex = new RegExp(
      `<note>([\\s\\S]*?<instrument id="${instrument_id}"\\s*\\/>([\\s\\S]*?))<\\/note>`,
      "g"
    );

    newPart = newPart.replace(noteRegex, (fullMatch, beforeRest) => {
      return `<note>${beforeRest}${codeToAdd}</note>`;
    });

    return xml.replace(originalPart, newPart);
  }

  ghost_note_fix(xml) {
    const snare_id = this.find_instrument_id(xml, "Ghost Snare Drum");
    return this.add_in_instrument(
      xml,
      snare_id,
      '<notehead parentheses="yes">normal</notehead>'
    );
  }
  crash_notehead_fix(xml) {
    const crash1_id = this.find_instrument_id(xml, "Crash Cymbal I");
    xml = this.add_in_instrument(
      xml,
      crash1_id,
      '<notehead smufl="noteheadXOrnate">other</notehead>'
    );
    const crash2_id = this.find_instrument_id(xml, "Crash Cymbal II");
    xml = this.add_in_instrument(
      xml,
      crash2_id,
      '<notehead smufl="noteheadXOrnate" parentheses="yes">other</notehead>'
    );
    const crash_general_id = this.find_instrument_id(xml, "Crash Cymbal");
    xml = this.add_in_instrument(
      xml,
      crash_general_id,
      '<notehead smufl="noteheadXOrnate">other</notehead>'
    );
    return xml;
  }
  hihat_notehead_fix(xml) {
    const snare_id = this.find_instrument_id(xml, "Hi-hat Closed");
    return this.add_in_instrument(xml, snare_id, "<notehead>x</notehead>");
  }

  word_to_rehearsal(xml, attributeFilters = {}) {
    return xml.replace(
      /<words([^>]*)>([\s\S]*?)<\/words>/g,
      (match, attrString, content) => {
        // Check if all provided attributes match in the tag
        const allMatch = Object.entries(attributeFilters).every(
          ([key, value]) => {
            const regex = new RegExp(`${key}=["']${value}["']`);
            return regex.test(attrString);
          }
        );

        if (allMatch) {
          return `<rehearsal${attrString}>${content}</rehearsal>`;
        }
        return match;
      }
    );
  }

  placement_change(xml, attributeFilters = {}, newPlacement) {
    return xml.replace(
      /<direction([^>]*)>([\s\S]*?)<\/direction>/g,
      (fullMatch, directionAttrs, innerContent) => {
        const wordsMatch = innerContent.match(
          /<words([^>]*)>([\s\S]*?)<\/words>/
        );
        if (!wordsMatch) return fullMatch;

        const wordAttrs = wordsMatch[1];

        const allMatch = Object.entries(attributeFilters).every(
          ([key, value]) => {
            const regex = new RegExp(`${key}=["']${value}["']`);
            return regex.test(wordAttrs);
          }
        );

        if (!allMatch) return fullMatch;

        // Update or insert placement
        let newDirectionAttrs = directionAttrs;

        if (/placement=["'][^"']*["']/.test(directionAttrs)) {
          newDirectionAttrs = directionAttrs.replace(
            /placement=["'][^"']*["']/,
            `placement="${newPlacement}"`
          );
        } else {
          newDirectionAttrs = ` placement="${newPlacement}"${directionAttrs}`;
        }

        return `<direction${newDirectionAttrs}>${innerContent}</direction>`;
      }
    );
  }

  bpm_remover(xml) {
    return xml.replace(
      /<direction-type>\s*<words[^>]*font-style=["']normal["'][^>]*font-weight=["']bold["'][^>]*>bpm<\/words>\s*<\/direction-type>/g,
      ""
    );
  }

  midi_fix(xml) {
    // 1. Prepare instrument name → unpitched MIDI map
    const instrumentMidiMap = {
      "Snare Drum": 39,
      "ick Drum I": 37, // I assume you meant "Kick Drum I"
      "Cross Stick": 38,
      "Crash Cymbal I": 50,
      Cowbell: 57,
      "Kick Drum II": 36,
      "Hi-hat Open": 47,
      "Hi-hat Closed": 43,
      "Hi-hat (pedal closed)": 45,
      "Hi-hat (pedal splash)": 47,
      "China Cymbal": 53,
      "Ride Cymbal": 52,
      "Ride Bell": 54,
      "Splash Cymbal": 56,
      "Ghost Snare Drum": 38,
      "Tom-tom I": 51,
      "Tom-tom II": 49,
      "Tom-tom III": 48,
      "Tom-tom IV": 46,
      "Crash Cymbal II": 50,
      "Floor Tom I": 44,
      "Floor Tom II": 42,
    };

    // 2. Remove all <instrument-sound> tags
    xml = xml.replace(/<instrument-sound>[\s\S]*?<\/instrument-sound>/g, "");

    // 3. Skip if MIDI already exists
    if (xml.includes("<midi-instrument") || xml.includes("<midi-device")) {
      return xml;
    }

    // 4. Build MIDI content
    let midiBlock = `  <midi-device>SmartMusic SoftSynth</midi-device>\n`;
    midiBlock += `  <midi-instrument id="P1-I1">\n`;
    midiBlock += `    <midi-channel>10</midi-channel>\n`;
    midiBlock += `    <midi-bank>15361</midi-bank>\n`;
    midiBlock += `    <midi-program>1</midi-program>\n`;
    midiBlock += `    <volume>80</volume>\n`;
    midiBlock += `    <pan>0</pan>\n`;
    midiBlock += `  </midi-instrument>\n`;

    // Add individual instruments
    for (const [name, midiUnpitched] of Object.entries(instrumentMidiMap)) {
      const instrumentId = this.find_instrument_id(xml, name);
      if (instrumentId) {
        midiBlock += `  <midi-instrument id="${instrumentId}">\n`;
        midiBlock += `    <midi-channel>10</midi-channel>\n`;
        midiBlock += `    <midi-bank>15361</midi-bank>\n`;
        midiBlock += `    <midi-program>1</midi-program>\n`;
        midiBlock += `    <midi-unpitched>${midiUnpitched}</midi-unpitched>\n`;
        midiBlock += `    <volume>80</volume>\n`;
        midiBlock += `    <pan>0</pan>\n`;
        midiBlock += `  </midi-instrument>\n`;
      }
    }

    // 5. Inject MIDI block after </score-part>
    xml = xml.replace(/<\/score-part>/, "</score-part>\n" + midiBlock);

    return xml;
  }

  swing_marks_fix(xml) {}
}

module.exports = new DoricoFixer();
