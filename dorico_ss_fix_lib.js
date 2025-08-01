const vkBeautify = require("vkbeautify");

class DoricoFixer {
  constructor() {
    this.logText = "";
  }

  appendLog(step, success, error) {
    if (success) {
      this.logText += `+ ${step}: SUCCESS\n`;
    } else {
      this.logText += `- ${step}: FAILED (${error})\n`;
    }
  }

  async validateXML(xmlString) {
    try {
      let parser;
      if (typeof DOMParser !== "undefined") {
        parser = new DOMParser();
      } else {
        // Node.js fallback: ensure @xmldom/xmldom is installed
        const { DOMParser } = await import("@xmldom/xmldom");
        parser = new DOMParser();
      }
      const doc = parser.parseFromString(xmlString, "application/xml");
      const errorNode = doc.getElementsByTagName("parsererror")[0];
      if (errorNode) {
        return {
          valid: false,
          error: errorNode.textContent.trim() || "Unknown XML parse error",
        };
      }
      return { valid: true };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  }

  async applyStep(stepName, currentXml, transformFn) {
    const before = currentXml;
    let after;
    try {
      after = transformFn(before);
    } catch (e) {
      this.appendLog(stepName, false, `Exception: ${e.message}`);
      return before;
    }

    const validation = await this.validateXML(after);
    if (validation.valid) {
      this.appendLog(stepName, true);
      return after;
    } else {
      this.appendLog(stepName, false, validation.error);
      return before;
    }
  }

  getLogText() {
    return this.logText.trim();
  }

  async fix(
    xmlContent,
    options = {
      p_clef: { sign: "percussion", visibility: "no", run: true },
      ghost_note: { run: true },
      crash_notehead: { notehead_type: "noteheadXOrnate", run: true },
      hihat_notehead: { run: true },
      word_to_rehearsal: { run: true },
      placement_change: { run: true },
      bpm_remover: { run: true },
      midi_fix: { run: true },
      beat_unit_changings_fix: { run: true },
      buzz_roll_fix: { run: true },
      swing_marks_fix: { run: true },
      remove_prevent_new_systems: { run: true },
    },
    instrumentData = {}
  ) {
    let fixed = xmlContent;

    if (options.p_clef.run) {
      fixed = await this.applyStep("p_clef_fix", fixed, (xml) =>
        this.p_clef_fix(xml, options.p_clef.sign, options.p_clef.visibility)
      );
    }
    if (options.ghost_note.run) {
      fixed = await this.applyStep("ghost_note_fix", fixed, (xml) =>
        this.ghost_note_fix(xml, instrumentData.ghost_snare_drum.names)
      );
    }
    if (options.crash_notehead.run) {
      fixed = await this.applyStep("crash_notehead_fix", fixed, (xml) =>
        this.crash_notehead_fix(
          xml,
          instrumentData.normal_crash_cymbal.names,
          instrumentData.choked_crash_cymbal.names,
          options.crash_notehead.notehead_type
        )
      );
    }
    if (options.hihat_notehead.run) {
      fixed = await this.applyStep("hihat_notehead_fix", fixed, (xml) =>
        this.hihat_notehead_fix(xml, instrumentData.hi_hat_closed.names)
      );
    }

    if (options.word_to_rehearsal.run) {
      //For finale format
      fixed = await this.applyStep(
        "word_to_rehearsal_for_finale",
        fixed,
        (xml) =>
          this.word_to_rehearsal(xml, {
            "font-family": "Times",
            "font-size": "12",
            "font-weight": "bold",
          })
      );
      //For old format
      fixed = await this.applyStep("word_to_rehearsal_old", fixed, (xml) =>
        this.word_to_rehearsal(xml, {
          "font-family": "Times New Roman",
          "font-size": "12",
          "font-weight": "bold",
        })
      );
      //For new format
      fixed = await this.applyStep("word_to_rehearsal_new", fixed, (xml) =>
        this.word_to_rehearsal(xml, {
          "font-family": "Arial",
          "font-size": "10",
          "font-weight": "bold",
        })
      );
    }

    if (options.placement_change.run) {
      fixed = await this.applyStep("placement_change", fixed, (xml) =>
        this.placement_change(
          xml,
          {
            "font-family": "Times New Roman",
            "font-size": "12",
            "font-weight": "bold",
          },
          "below"
        )
      );
    }

    if (options.bpm_remover.run) {
      fixed = await this.applyStep("bpm_remover", fixed, (xml) =>
        this.bpm_remover(xml)
      );
    }

    if (options.midi_fix.run) {
      fixed = await this.applyStep("midi_fix", fixed, (xml) =>
        this.midi_fix(xml, instrumentData)
      );
    }

    if (options.beat_unit_changings_fix.run) {
      fixed = await this.applyStep("beat_unit_changings_fix", fixed, (xml) =>
        this.beat_unit_changings_fix(xml)
      );
    }

    if (options.buzz_roll_fix.run) {
      fixed = await this.applyStep("buzz_roll_fix", fixed, (xml) =>
        this.buzz_roll_fix(xml)
      );
    }

    if (options.swing_marks_fix.run) {
      fixed = await this.applyStep("swing_marks_fix", fixed, (xml) =>
        this.swing_marks_fix(xml)
      );
    }

    if (options.remove_prevent_new_systems.run) {
      fixed = await this.applyStep("remove_prevent_new_systems", fixed, (xml) =>
        this.remove_prevent_new_systems(xml)
      );
    }

    console.log("DoricoFixer Log:\n" + this.logText);
    // Format XML before returning
    fixed = vkBeautify.xml(fixed);
    return [fixed, this.logText];
  }

  p_clef_fix(xml, clef_type = "percussion", visibility = "no") {
    const partStart = xml.indexOf('<part id="P1"');
    if (partStart === -1) return xml;

    const partEnd = xml.indexOf("</part>", partStart);
    const partContent = xml.substring(partStart, partEnd);

    // Match the first <measure> regardless of number
    const measureMatch = partContent.match(
      /<measure[^>]*>([\s\S]*?)<\/measure>/
    );
    if (!measureMatch) return xml;

    const measureContent = measureMatch[0];
    const attributesMatch = measureContent.match(
      /<attributes>([\s\S]*?)<\/attributes>/
    );

    // Create dynamic clef regex and new clef XML
    const clefRegex = new RegExp(
      `<clef[^>]*print-object=['"]${visibility}['"][^>]*>\\s*<sign>${clef_type}<\\/sign>\\s*<\\/clef>`
    );

    const newClef = `  <clef print-object="${visibility}">\n    <sign>${clef_type}</sign>\n  </clef>\n`;

    let updatedMeasure = measureContent;

    if (attributesMatch) {
      const attributesContent = attributesMatch[0];

      if (!clefRegex.test(attributesContent)) {
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
      // No <attributes> — create one and add clef
      const newAttributesBlock = `  <attributes>\n${newClef}  </attributes>\n`;
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
      if (!nameMatch) continue;

      const actualName = nameMatch[1].trim();
      const searchName = instrument_name.trim();

      if (!searchName.startsWith("%") || !searchName.endsWith("%")) {
        if (actualName === searchName) {
          return id;
        }
      } else {
        // Remove surrounding % and split the remaining parts
        const keywords = searchName.slice(1, -1).split("%").filter(Boolean);

        const lowerName = actualName.toLowerCase();
        const allKeywordsMatch = keywords.every((keyword) =>
          lowerName.includes(keyword.toLowerCase())
        );

        if (allKeywordsMatch) {
          return id;
        }
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

  remove_notehead_in_instrument(xml, instrument_id) {
    // Match each <note>...</note>
    return xml.replace(/<note>[\s\S]*?<\/note>/gi, (noteBlock) => {
      // Only operate if this note contains the target instrument
      const instrRe = new RegExp(
        `<instrument\\s+id="${instrument_id}"\\s*\\/?>`,
        "i"
      );
      if (!instrRe.test(noteBlock)) return noteBlock;

      // Remove all paired <notehead>...</notehead>
      const noteheadPairedRe = /<notehead\b[^>]*>[\s\S]*?<\/notehead>/gi;
      return noteBlock.replace(noteheadPairedRe, "");
    });
  }

  ghost_note_fix(
    xml,
    ghost_note_names = ["Ghost Snare Drum", "%Ghost%Snare%"]
  ) {
    ghost_note_names.map((name) => {
      const instrumentId = this.find_instrument_id(xml, name);
      if (instrumentId) {
        xml = this.add_in_instrument(
          xml,
          instrumentId,
          '<notehead parentheses="yes">normal</notehead>'
        );
      }
    });
    return xml;
  }

  crash_notehead_fix(
    xml,
    normal_crash_names = ["Crash Cymbal I", "Crash Cymbal"],
    choked_crash_names = ["Crash Cymbal II", "%Choked%Crash%"],
    notehead_type = "noteheadXOrnate"
  ) {
    normal_crash_names.map((name) => {
      const instrumentId = this.find_instrument_id(xml, name);
      if (instrumentId) {
        xml = this.remove_notehead_in_instrument(xml, instrumentId, "notehead");
        xml = this.add_in_instrument(
          xml,
          instrumentId,
          notehead_type == "noteheadXOrnate"
            ? '<notehead smufl="noteheadXOrnate">other</notehead>'
            : "<notehead>x</notehead>"
        );
      }
    });

    choked_crash_names.map((name) => {
      const instrumentId = this.find_instrument_id(xml, name);
      if (instrumentId) {
        xml = this.remove_notehead_in_instrument(xml, instrumentId, "notehead");
        xml = this.add_in_instrument(
          xml,
          instrumentId,
          notehead_type == "noteheadXOrnate"
            ? '<notehead smufl="noteheadXOrnate" parentheses="yes">other</notehead>'
            : '<notehead parentheses="yes">x</notehead>'
        );
      }
    });
    return xml;
  }

  hihat_notehead_fix(
    xml,
    closed_hihat_names = ["Hi-hat Closed", "%Hi%hat%Closed%"]
  ) {
    closed_hihat_names.map((name) => {
      const instrumentId = this.find_instrument_id(xml, name);
      if (instrumentId) {
        xml = this.add_in_instrument(
          xml,
          instrumentId,
          "<notehead>x</notehead>"
        );
      }
    });
    return xml;
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
    return xml
      .replace(
        /<direction-type>\s*<words[^>]*font-style=["']normal["'][^>]*font-weight=["']bold["'][^>]*>[^<]*bpm[^<]*<\/words>\s*<\/direction-type>/gi,
        ""
      )
      .replace(
        /<words\s+font-family=["']Arial["']\s+font-size=["']6["']\s+valign=["']top["']>\s*=\s*<\/words>/gi,
        ""
      );
  }

  midi_fix(xml, instrumentData) {
    // 1. Remove all <instrument-sound> tags
    xml = xml.replace(/<instrument-sound>[\s\S]*?<\/instrument-sound>/g, "");

    // 2. Skip if MIDI already exists
    if (xml.includes("<midi-instrument") || xml.includes("<midi-device")) {
      return xml;
    }

    // 3. Build MIDI content
    let midiBlock = `  <midi-device>SmartMusic SoftSynth</midi-device>\n`;
    midiBlock += `  <midi-instrument id="P1-I1">\n`;
    midiBlock += `    <midi-channel>10</midi-channel>\n`;
    midiBlock += `    <midi-bank>15361</midi-bank>\n`;
    midiBlock += `    <midi-program>1</midi-program>\n`;
    midiBlock += `    <volume>80</volume>\n`;
    midiBlock += `    <pan>0</pan>\n`;
    midiBlock += `  </midi-instrument>\n`;

    // 4. Loop over instrumentData
    for (const entry of Object.values(instrumentData)) {
      const { names, id: midiUnpitched } = entry;
      let matchedId = null;

      for (const name of names) {
        const foundId = this.find_instrument_id(xml, name);
        if (foundId) {
          matchedId = foundId;
          break;
        }
      }

      if (matchedId) {
        midiBlock += `  <midi-instrument id="${matchedId}">\n`;
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

  beat_unit_changings_fix(xml) {
    const directionRegex = /<direction\b([^>]*)>([\s\S]*?)<\/direction>/g;
    let matches = [];
    let match;

    // First, collect all direction blocks that qualify
    while ((match = directionRegex.exec(xml)) !== null) {
      const [fullDirection, directionAttrs, directionContent] = match;

      const metronomeMatch = directionContent.match(
        /<direction-type\b([^>]*)>([\s\S]*?)<\/direction-type>/i
      );
      if (!metronomeMatch) continue;

      const [_, directionTypeAttrs, directionTypeContent] = metronomeMatch;

      const beatUnitsMatch = directionTypeContent.match(
        /<metronome\b[^>]*>([\s\S]*?)<\/metronome>/i
      );
      if (!beatUnitsMatch) continue;

      const beatUnitTags = beatUnitsMatch[1].match(
        /<beat-unit>.*?<\/beat-unit>/g
      );
      if (!beatUnitTags || beatUnitTags.length !== 2) continue;

      const getDottedBeatUnit = (content, index) => {
        const beatUnitTag = beatUnitTags[index];
        const beatUnitValue = beatUnitTag.replace(/<\/?beat-unit>/g, "").trim();

        const regex = new RegExp(
          escapeRegExp(beatUnitTag) + "\\s*<beat-unit-dot\\s*/>",
          "i"
        );
        const isDotted = regex.test(content);

        return isDotted ? `Dotted ${beatUnitValue}` : beatUnitValue;
      };

      const escapeRegExp = (string) =>
        string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      const beat1 = getDottedBeatUnit(beatUnitsMatch[1], 0);
      const beat2 = getDottedBeatUnit(beatUnitsMatch[1], 1);

      const wordText =
        beat1.charAt(0).toUpperCase() +
        beat1.slice(1) +
        " note = " +
        beat2.charAt(0).toLowerCase() +
        beat2.slice(1) +
        " note";

      const newDirectionTypeContent = directionTypeContent.replace(
        /<metronome\b[^>]*>[\s\S]*?<\/metronome>/i,
        `<words>${wordText}</words>`
      );

      const newDirection = `<direction${directionAttrs}>
  <direction-type${directionTypeAttrs}>${newDirectionTypeContent}</direction-type>
</direction>`;

      matches.push({
        original: fullDirection,
        newTag: newDirection,
        startIndex: match.index,
      });
    }

    // Process in reverse to avoid index shifting issues
    for (let i = matches.length - 1; i >= 0; i--) {
      const { original, newTag, startIndex } = matches[i];
      const beforeDirection = xml.slice(0, startIndex);

      const noteMatch = [
        ...beforeDirection.matchAll(/<note\b[^>]*>[\s\S]*?<\/note>/g),
      ].pop();
      if (noteMatch) {
        const noteStart = noteMatch.index;
        const noteEnd = noteStart + noteMatch[0].length;

        xml = xml.slice(0, noteStart) + newTag + "\n" + xml.slice(noteStart);
        xml = xml.replace(original, "");
      }
    }

    return xml;
  }

  buzz_roll_fix(xml) {
    const directionRegex = /<direction\b([^>]*)>([\s\S]*?)<\/direction>/g;
    let result;
    const replacements = [];

    while ((result = directionRegex.exec(xml)) !== null) {
      const fullDirection = result[0];
      const directionAttrs = result[1];
      const directionInner = result[2];

      const directionTypeRegex =
        /<direction-type\b([^>]*)>([\s\S]*?)<\/direction-type>/;
      const dirTypeMatch = directionInner.match(directionTypeRegex);
      if (!dirTypeMatch) continue;

      const dirTypeAttrs = dirTypeMatch[1];
      const dirTypeInner = dirTypeMatch[2];

      const wordsRegex =
        /<words\b([^>]*)font-family=["']Maestro["'][^>]*>(\s*z\s*)<\/words>/;
      const wordsMatch = dirTypeInner.match(wordsRegex);
      if (!wordsMatch) continue;

      const fullWords = wordsMatch[0];

      // Now find the next note after this <direction>
      const searchFrom = directionRegex.lastIndex;
      const noteMatch = xml.slice(searchFrom).match(/<note>([\s\S]*?)<\/note>/);
      if (!noteMatch) continue;

      const fullNote = noteMatch[0];
      const noteStartIndex = searchFrom + noteMatch.index;

      // Add <notations> if not already present
      let newNote = fullNote;
      if (!fullNote.includes("<notations>")) {
        newNote = fullNote.replace(
          "</note>",
          `<notations>
  <ornaments>
    <tremolo type="unmeasured">0</tremolo>
  </ornaments>
</notations></note>`
        );
      }

      // Prepare new <direction>:
      let newDirection = "";

      // Remove just the <words>z</words> part
      const newDirTypeInner = dirTypeInner.replace(fullWords, "").trim();

      if (newDirTypeInner === "") {
        // <direction-type> was only the <words z>, remove entire <direction>
        newDirection = "";
      } else {
        // Reconstruct <direction> with <direction-type> minus the <words>
        newDirection = `<direction${directionAttrs}>
  <direction-type${dirTypeAttrs}>${newDirTypeInner}</direction-type>
</direction>`;
      }

      replacements.push({
        oldDirection: fullDirection,
        newDirection,
        oldNote: fullNote,
        newNote,
      });
    }

    // Apply replacements in reverse order to preserve index integrity
    for (let i = replacements.length - 1; i >= 0; i--) {
      const { oldDirection, newDirection, oldNote, newNote } = replacements[i];
      xml = xml.replace(oldDirection, newDirection);
      xml = xml.replace(oldNote, newNote);
    }

    return xml;
  }

  swing_marks_fix(xml) {
    // Regex to find relevant <words> tags
    const swingRegex =
      /<direction-type>\s*<words[^>]*font-family="MaestroTimes"[^>]*>([^<]+)<\/words>\s*<\/direction-type>/g;

    // Map MaestroTimes swing equations to metronome XML
    function maestroToMetronome(equation) {
      // Example: "ŒÂ = Œ Ç‰"
      // You should expand this mapping for all MaestroTimes swing marks you need
      if (/ŒÂ\s*=\s*Œ\s*Ç‰/.test(equation)) {
        return `
<direction-type>
  <metronome default-y="40" font-family="MaestroTimes" font-size="13.7" font-weight="bold" halign="left">
    <metronome-note>
      <metronome-type>eighth</metronome-type>
      <metronome-beam number="1">begin</metronome-beam>
    </metronome-note>
    <metronome-note>
      <metronome-type>eighth</metronome-type>
      <metronome-beam number="1">end</metronome-beam>
    </metronome-note>
    <metronome-relation>equals</metronome-relation>
    <metronome-note>
      <metronome-type>quarter</metronome-type>
      <metronome-tuplet bracket="yes" type="start">
        <actual-notes>3</actual-notes>
        <normal-notes>2</normal-notes>
      </metronome-tuplet>
    </metronome-note>
    <metronome-note>
      <metronome-type>eighth</metronome-type>
      <metronome-tuplet type="stop">
        <actual-notes>3</actual-notes>
        <normal-notes>2</normal-notes>
      </metronome-tuplet>
    </metronome-note>
  </metronome>
</direction-type>
        `.trim();
      } else if (/ŒÊ\s*=\s*‰ÇÙ/.test(equation)) {
        return `
<direction-type>
  <words>Swing sixteenth notes as triplets</words>
</direction-type>
        `.trim();
      }
      // Add more mappings as needed
      return null;
    }

    // Replace all swing <words> with metronome XML
    return xml.replace(swingRegex, (match, equation) => {
      const metronomeXML = maestroToMetronome(equation.trim());
      return metronomeXML ? metronomeXML : match;
    });
  }

  remove_prevent_new_systems(xml) {
    return xml.replace(/\s*new-system\s*=\s*(['"])no\1/g, "");
  }
}

module.exports = new DoricoFixer();
