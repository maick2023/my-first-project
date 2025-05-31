import re

def parse_ocr_text(raw_text):
    """
    Processes raw OCR text to heuristically segment it into question-answer pairs.
    Outputs: A list of dictionaries, e.g.,
             [{'id': 1, 'question': 'text_of_question_1', 'answer': 'text_of_answer_1'}, ...]
    """
    if not raw_text or raw_text.isspace():
        return []

    # Preprocessing: split into lines and remove excessive whitespace/empty lines
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]

    if not lines:
        return []

    parsed_items = []
    current_question = None
    current_answer_lines = []
    item_id_counter = 1

    # Regex to identify question markers (numbers, specific keywords)
    # Adjust regex to be more inclusive of Chinese characters and common markers
    # "题目", "问题", "Q:", "〇", "□", numbers followed by a period or Chinese punctuation like "、", "．"
    question_pattern = re.compile(
        r'^(?:\d+[．.\u3001\s]|题目\s*\d*[:：\s]*|问题\s*\d*[:：\s]*|Q\s*\d*[:：\s]*|[〇□]\s*\d*)\s*(.+)',
        re.IGNORECASE
    )
    # Answer markers (less explicit, often follows a question)
    # For now, we'll assume text after a question is an answer until a new question or end of text.

    for i, line in enumerate(lines):
        match = question_pattern.match(line)
        if match:
            # If there's a pending answer for a previous question, save it.
            if current_question and current_answer_lines:
                parsed_items.append({
                    'id': item_id_counter,
                    'question': current_question,
                    'answer': "\n".join(current_answer_lines).strip()
                })
                item_id_counter += 1
                current_answer_lines = []

            # Start of a new question
            current_question = line # Use the full line as question for now. Could refine to match.group(1)

            # Check if the next line could be part of this question (e.g. question text spans multiple lines)
            # This is a simple heuristic, might need more advanced logic
            if (i + 1 < len(lines)) and not question_pattern.match(lines[i+1]):
                # If the current question text itself is very short, and next line is not a question,
                # it might be that the question text is actually in the next line.
                # This is a tricky heuristic. For now, let's keep it simple: question is the matched line.
                pass

        elif current_question:
            # This line is part of an answer
            current_answer_lines.append(line)
        else:
            # This line is not part of a question and no current question is active.
            # Could be preamble or unrelated text. For now, we can collect it as an 'unknown' block
            # or simply ignore it if it doesn't fit the Q&A structure.
            # For this version, we'll ignore lines that don't follow an active question.
            pass

    # Add the last processed Q&A pair if any
    if current_question and current_answer_lines:
        parsed_items.append({
            'id': item_id_counter,
            'question': current_question,
            'answer': "\n".join(current_answer_lines).strip()
        })
    elif current_question and not current_answer_lines: # Question without an answer
        parsed_items.append({
            'id': item_id_counter,
            'question': current_question,
            'answer': "" # Or some placeholder like "No answer found"
        })

    # If no Q&A pairs were found, but there was text, return it as a single block
    if not parsed_items and lines:
        return [{'id': 1, 'type': 'unknown', 'text': "\n".join(lines)}]

    return parsed_items
