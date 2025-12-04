/**
 * Document Q&A Service
 * Фаза 2: Автоматическая генерация вопросов и извлечение ответов
 *
 * Реализует Document Q&A Flow согласно document_qa_flow.md
 */

import { logger } from '../utils/logger.js';

/**
 * Generate clarification questions from parsed document
 *
 * @param {Object} parsedDocument - Parsed document from STAVAGENT SmartParser
 * @param {Object} partialContext - Partially extracted context (may have gaps)
 * @returns {Promise<Array>} Array of questions
 */
export async function generateQuestions(parsedDocument, partialContext) {
  logger.info('[Q&A] Generating clarification questions...');

  const questions = [];

  // Check what's missing in partial context
  if (!partialContext.building_type || partialContext.building_type === 'neurčeno') {
    questions.push({
      id: 'q_building_type',
      question: 'Jaký je typ stavby?',
      category: 'specifications',
      priority: 'high',
      context: 'Typ stavby je kritický pro určení správných položek URS. Např.: bytový dům, rodinný dům, most, garáž.',
      expected_format: 'text',
      answer: null,
      confidence: 0.0
    });
  }

  if (!partialContext.storeys || partialContext.storeys === 0) {
    questions.push({
      id: 'q_storeys',
      question: 'Kolik má stavba nadzemních podlaží?',
      category: 'dimensions',
      priority: 'high',
      context: 'Počet podlaží ovlivňuje množství některých prací (např. lešení, vertikální doprava).',
      expected_format: 'number',
      answer: null,
      confidence: 0.0
    });
  }

  if (!partialContext.main_system || partialContext.main_system.length === 0) {
    questions.push({
      id: 'q_main_system',
      question: 'Jaké jsou hlavní konstrukční systémy? (např. zdivo, železobeton, ocel)',
      category: 'materials',
      priority: 'high',
      context: 'Konstrukční systém určuje typ a množství potřebných prací.',
      expected_format: 'array',
      answer: null,
      confidence: 0.0
    });
  }

  // Additional questions based on document type
  const text = (parsedDocument.full_text || '').toLowerCase();

  // Check for foundation specifications
  if (text.includes('základ') || text.includes('foundation')) {
    if (!text.includes('c20') && !text.includes('c25') && !text.includes('c30')) {
      questions.push({
        id: 'q_foundation_concrete',
        question: 'Jaká třída betonu je použita pro základy? (např. C25/30, C30/37)',
        category: 'materials',
        priority: 'high',
        context: 'Třída betonu je nutná pro přesné oceňování základových konstrukcí.',
        expected_format: 'text',
        answer: null,
        confidence: 0.0
      });
    }
  }

  // Check for wall material specifications
  if (text.includes('zdivo') || text.includes('wall') || text.includes('stěna')) {
    const hasPorotherm = text.includes('porotherm');
    const hasYtong = text.includes('ytong');
    const hasBrick = text.includes('cihel') || text.includes('brick');

    if (hasBrick && !hasPorotherm && !hasYtong) {
      questions.push({
        id: 'q_wall_material',
        question: 'Jaký konkrétní typ zdiva? (Porotherm, Ytong, jiný výrobce?)',
        category: 'materials',
        priority: 'medium',
        context: 'Obecné "zdivo" je uvedeno, ale potřebujeme konkrétní typ pro přesné ceny.',
        expected_format: 'text',
        answer: null,
        confidence: 0.0
      });
    }
  }

  // Check for insulation
  if (text.includes('izolace') || text.includes('insulation')) {
    if (!text.includes('polystyren') && !text.includes('eps') && !text.includes('xps')) {
      questions.push({
        id: 'q_insulation',
        question: 'Jaký materiál tepelné izolace? (např. EPS, XPS, minerální vlna)',
        category: 'materials',
        priority: 'medium',
        context: 'Typ izolace ovlivňuje cenu a technologii montáže.',
        expected_format: 'text',
        answer: null,
        confidence: 0.0
      });
    }
  }

  // Check for roofing
  if (text.includes('střecha') || text.includes('roof')) {
    questions.push({
      id: 'q_roofing',
      question: 'Jaký materiál střešní krytiny? (např. betonová taška, plechová střecha, asfaltové pásy)',
      category: 'materials',
      priority: 'medium',
      context: 'Střešní krytina má velký vliv na celkovou cenu.',
      expected_format: 'text',
      answer: null,
      confidence: 0.0
    });
  }

  logger.info(`[Q&A] Generated ${questions.length} clarification questions`);

  return questions;
}

/**
 * Extract answer to a specific question from parsed document
 *
 * @param {Object} question - Question object
 * @param {Object} parsedDocument - Parsed document
 * @returns {Promise<Object>} Answer with source and confidence
 */
export async function extractAnswer(question, parsedDocument) {
  logger.info(`[Q&A] Extracting answer for: ${question.id}`);

  const text = parsedDocument.full_text || '';
  const textLower = text.toLowerCase();

  let answer = null;
  let source = null;
  let confidence = 0.0;
  let excerpt = null;

  // Simple pattern-based extraction (MVP)
  // TODO: Replace with Claude-based extraction in Phase 2 full
  switch (question.id) {
  case 'q_building_type':
    if (textLower.includes('bytový dům') || textLower.includes('bytový')) {
      answer = 'bytový dům';
      confidence = 0.85;
      excerpt = extractExcerpt(text, 'bytový');
    } else if (textLower.includes('rodinný dům')) {
      answer = 'rodinný dům';
      confidence = 0.85;
      excerpt = extractExcerpt(text, 'rodinný');
    } else if (textLower.includes('most')) {
      answer = 'most';
      confidence = 0.9;
      excerpt = extractExcerpt(text, 'most');
    }
    break;

  case 'q_storeys': {
    // Look for patterns like "4NP", "5 podlaží", "3-storey"
    const storeysPatterns = [
      /(\d+)\s*np/i,
      /(\d+)\s*nadzemní/i,
      /(\d+)\s*podlaží/i,
      /(\d+)\s*storey/i
    ];

    for (const pattern of storeysPatterns) {
      const match = text.match(pattern);
      if (match) {
        answer = parseInt(match[1], 10);
        confidence = 0.9;
        excerpt = match[0];
        break;
      }
    }
    break;
  }

  case 'q_foundation_concrete': {
    // Look for concrete grades
    const concreteMatch = text.match(/c\s*(\d+)\/(\d+)/i);
    if (concreteMatch) {
      answer = `C${concreteMatch[1]}/${concreteMatch[2]}`;
      confidence = 0.95;
      excerpt = extractExcerpt(text, concreteMatch[0]);
    }
    break;
  }

  case 'q_wall_material':
    if (textLower.includes('porotherm')) {
      // Try to get specific Porotherm type
      const porothermMatch = text.match(/porotherm\s*\d+/i);
      answer = porothermMatch ? porothermMatch[0] : 'Porotherm';
      confidence = 0.9;
      excerpt = extractExcerpt(text, 'porotherm');
    } else if (textLower.includes('ytong')) {
      answer = 'Ytong';
      confidence = 0.9;
      excerpt = extractExcerpt(text, 'ytong');
    }
    break;

  case 'q_insulation':
    if (textLower.includes('polystyren') || textLower.includes('eps')) {
      answer = 'EPS polystyren';
      confidence = 0.85;
      excerpt = extractExcerpt(text, 'polystyren');
    } else if (textLower.includes('xps')) {
      answer = 'XPS extrudovaný polystyren';
      confidence = 0.9;
      excerpt = extractExcerpt(text, 'xps');
    } else if (textLower.includes('minerální') && textLower.includes('vlna')) {
      answer = 'minerální vlna';
      confidence = 0.85;
      excerpt = extractExcerpt(text, 'minerální');
    }
    break;

  case 'q_roofing':
    if (textLower.includes('betonov') && textLower.includes('taška')) {
      answer = 'betonová taška';
      confidence = 0.85;
      excerpt = extractExcerpt(text, 'taška');
    } else if (textLower.includes('plech')) {
      answer = 'plechová střecha';
      confidence = 0.8;
      excerpt = extractExcerpt(text, 'plech');
    } else if (textLower.includes('asfalt')) {
      answer = 'asfaltové pásy';
      confidence = 0.85;
      excerpt = extractExcerpt(text, 'asfalt');
    }
    break;
  }

  if (answer) {
    source = {
      document: parsedDocument.filename || 'uploaded_document',
      location: 'full_text',
      excerpt: excerpt
    };
  }

  logger.info(`[Q&A] Answer extracted: ${answer ? 'found' : 'not found'} (confidence: ${confidence})`);

  return {
    question_id: question.id,
    found: answer !== null,
    answer: answer,
    source: source,
    confidence: confidence,
    excerpt: excerpt
  };
}

/**
 * Extract excerpt from text around a search term
 */
function extractExcerpt(text, searchTerm, contextLength = 100) {
  const lowerText = text.toLowerCase();
  const lowerTerm = searchTerm.toLowerCase();
  const index = lowerText.indexOf(lowerTerm);

  if (index === -1) {return null;}

  const start = Math.max(0, index - contextLength);
  const end = Math.min(text.length, index + searchTerm.length + contextLength);

  let excerpt = text.substring(start, end).trim();

  // Add ellipsis if truncated
  if (start > 0) {excerpt = '...' + excerpt;}
  if (end < text.length) {excerpt = excerpt + '...';}

  return excerpt;
}

/**
 * Run complete Q&A flow
 *
 * @param {Object} parsedDocument - Parsed document
 * @param {Object} partialContext - Partially extracted context
 * @returns {Promise<Object>} Q&A results with questions and answers
 */
export async function runQAFlow(parsedDocument, partialContext) {
  logger.info('[Q&A] Starting Document Q&A Flow...');

  // Generate questions
  const questions = await generateQuestions(parsedDocument, partialContext);

  // Extract answers for each question
  const answersPromises = questions.map(q => extractAnswer(q, parsedDocument));
  const answers = await Promise.all(answersPromises);

  // Update questions with answers
  const questionsWithAnswers = questions.map(q => {
    const answer = answers.find(a => a.question_id === q.id);
    return {
      ...q,
      answer: answer?.answer || null,
      source: answer?.source || null,
      confidence: answer?.confidence || 0.0,
      found: answer?.found || false
    };
  });

  // Separate found/not found
  const answeredQuestions = questionsWithAnswers.filter(q => q.found);
  const unansweredQuestions = questionsWithAnswers.filter(q => !q.found);

  // Build enhanced context from answers
  const enhancedContext = { ...partialContext };

  answeredQuestions.forEach(q => {
    switch (q.id) {
    case 'q_building_type':
      enhancedContext.building_type = q.answer;
      break;
    case 'q_storeys':
      enhancedContext.storeys = q.answer;
      break;
    case 'q_foundation_concrete':
      enhancedContext.foundation_concrete = q.answer;
      break;
    case 'q_wall_material':
      if (!enhancedContext.main_system) {enhancedContext.main_system = [];}
      enhancedContext.main_system.push(q.answer);
      break;
    }
  });

  logger.info(`[Q&A] Flow completed: ${answeredQuestions.length} answered, ${unansweredQuestions.length} need clarification`);

  return {
    questions: questionsWithAnswers,
    answered_count: answeredQuestions.length,
    unanswered_count: unansweredQuestions.length,
    enhanced_context: enhancedContext,
    requires_user_input: unansweredQuestions.length > 0,
    rfi_needed: unansweredQuestions.filter(q => q.priority === 'high').length > 0
  };
}
