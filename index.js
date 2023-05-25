import { Grammarly } from "@stewartmcgown/grammarly-api";
import express from "express";
import cors from "cors";

const app = express();

app.use(cors());

function applyTransform(text, alert) {
  let {
    begin,
    end,
    replacements: [replacement],
  } = alert;
  const shouldReplace = typeof replacement === "string";
  if (!shouldReplace) {
    return { text, diff: 0 };
  }

  const substringToTransform = text.substring(begin, end);
  const transformed = shouldReplace
    ? text.substring(0, begin) + replacement + text.substring(end)
    : text;
  const diff = shouldReplace
    ? replacement.length - substringToTransform.length
    : 0;
  return {
    text: transformed,
    diff,
  };
}

/**
 * Corrects a Grammarly result and returns the updated object
 */
function correct(result) {
  const { alerts } = result;
  return alerts
    .filter((x) => !x.hidden)
    .sort((a, b) => b.begin - a.begin)
    .reduce((prev, currentAlert) => {
      const { text, diff } = applyTransform(
        prev.corrected || prev.original,
        currentAlert
      );
      return Object.assign({}, prev, { corrected: text });
    }, result);
}

const getRequiredDetailsFromGrammarly = (response) => {
  const alerts = response.alerts.map((alert) => {
    const {
      title,
      minicardTitle,
      result,
      details,
      explanation,
      todo,
      text,
      cardLayout: { group },
    } = alert;
    return {
      title: cleanOutput(title),
      minicardTitle: cleanOutput(minicardTitle),
      result: cleanOutput(result),
      details: cleanOutput(details),
      explanation: cleanOutput(explanation),
      todo: cleanOutput(todo),
      text: cleanOutput(text),
      group: cleanOutput(group),
    };
  });
  const { score, outcomeScores, generalScore } = response.result;
  const { corrected } = response;
  return {
    alerts,
    score: { score, outcomeScores, generalScore },
    corrected,
  };
};

const cleanOutput = (inputQuery) => {
  const newLineRegEx = /\r?\n|\r/;
  const htmlRegEx = /(<([^>]+)>)/gi;
  const removeSpace = /\u00a0/g;
  const removeWhiteSpace = /\s+/g;
  const removeExtra = (query) =>
    query
      .replace(newLineRegEx, " ")
      .replace(htmlRegEx, " ")
      .replace(removeSpace, " ")
      .replace(removeWhiteSpace, " ")
      .trim();
  return inputQuery ? removeExtra(inputQuery) : inputQuery;
};

app.get("/api/v1/check", async function (req, res) {
  try {
    const grammarly = new Grammarly();
    const { text } = req.query;
    if (text.length > 0) {
      const results = await grammarly.analyse(text).then(correct);
      const finalResults = getRequiredDetailsFromGrammarly(results);
      res.status(200).send(finalResults);
    } else {
      res.status(200).send([]);
    }
  } catch (error) {
    console.error(error);
    res.status(404).send("Error! Something is really wrong.");
  }
});

app.get("/", (req, res) =>
  res.status(200).send("Welcome to Jaynil's Grammar Checker!")
);

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Grammar Checker Running on ${port}`);
});
