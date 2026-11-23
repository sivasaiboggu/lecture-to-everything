/* Bundled sample lecture — original content written for this project.
   A 12-minute lecture, "Gradient Descent, Explained". Not a recording of
   anyone else's lecture. Transcript, notes, flashcards, quiz and mind map
   were written together so every artefact agrees with the transcript. */
const SAMPLE_LECTURE = {
  "id": "sample-gradient-descent",
  "title": "Gradient Descent, Explained",
  "source": "sample",
  "durationSec": 720,
  "createdAt": "2026-11-23T00:00:00.000Z",
  "lecturer": "Sample lecture (written for this demo)",
  "transcript": [
    { "startSec": 0, "text": "Welcome back. Today we are going to take one idea, gradient descent, and follow it all the way from a picture to a working training loop. By the end you will be able to write the update rule from memory, explain what the learning rate does, and say why training sometimes fails. No new maths beyond a slope. Keep one picture in mind the whole way through: a ball rolling downhill in a valley. The valley is the loss, the ball is the model, and gradient descent is the rule that tells the ball which way to roll." },
    { "startSec": 55, "text": "First, why is learning an optimisation problem at all? A model makes predictions, and some of those predictions are wrong. We need a single number that says how wrong the model is right now, so we can make that number smaller. That is all training is: pick the model's numbers, measure how wrong it is, change the numbers to be less wrong, repeat. If you can measure wrongness, you can learn. If you cannot measure it, you are guessing. So the first job in any machine learning project is not the model. It is the measure." },
    { "startSec": 140, "text": "That measure is called the loss function. For a regression problem, the usual choice is mean squared error: take each prediction, subtract the true value, square the difference, and average over all examples. Squaring matters. It makes big errors count much more than small ones, and it makes the loss always positive, so zero means perfect and anything above zero means some error remains. For classification we usually use cross-entropy instead, but the idea is identical: one number, lower is better, zero is perfect. Plot the loss against one parameter and you get a curve. Plot it against two parameters and you get a surface, a landscape with valleys. Training is walking downhill on that landscape." },
    { "startSec": 230, "text": "So how do we know which way is downhill? That is what the gradient gives us. The gradient is the slope of the loss at the current point, for every parameter at once. In one dimension it is just the derivative: how fast the loss changes when you nudge the parameter. In many dimensions it is a vector of those slopes, one per parameter, pointing in the direction where the loss rises fastest. That is the key fact, and it is easy to get backwards: the gradient points uphill, towards higher loss. So to go downhill we step in the opposite direction, against the gradient. The update rule is one line. New parameter equals old parameter minus the learning rate times the gradient. Theta new equals theta old minus alpha times the gradient of the loss. That line is the whole algorithm." },
    { "startSec": 320, "text": "Now the learning rate, alpha. It is the size of each step. It is the one number you will tune more than any other, and it decides whether training works at all. Think of the ball again. A small learning rate is a ball taking tiny careful steps: it will get to the bottom eventually, but it may take thousands of steps, and on a large problem that means hours you do not have. A large learning rate is a ball taking huge leaps: it can jump straight over the valley and land higher on the other side, then jump back, oscillating forever and never settling. The loss goes down, then up, then down. If your loss curve looks like a sawtooth, your learning rate is almost certainly too big. A common starting point is 0.01 or 0.001, and you adjust from what the loss curve shows you, not from a rule book." },
    { "startSec": 410, "text": "Let me show you what too big and too small look like in practice. Too small: the loss falls slowly and smoothly, a gentle slope downwards, and after a hundred steps it has barely moved. You are wasting compute. Too big: the loss falls fast for a few steps, then jumps up, then falls, then jumps higher. That is divergence, and the fix is to cut the learning rate, often by a factor of ten. Just right: the loss falls steeply at first and then flattens as it approaches the bottom. That flattening is normal. Near the bottom the gradient is small, so the steps get small on their own. That is a built-in property of the rule: steps shrink as you approach the minimum, which is why gradient descent can settle instead of orbiting forever." },
    { "startSec": 490, "text": "Now the bad news. The landscape is rarely one smooth valley. Real loss surfaces have many valleys, and gradient descent only walks downhill from where it starts, so it can stop in a shallow valley, a local minimum, while a deeper valley sits nearby. In practice this is less of a disaster than the textbooks suggest. In high dimensions, most of these stopping points are saddle points, flat in some directions and sloping in others, and a little noise is usually enough to escape them. Starting from different random initial values and keeping the best run is a cheap, honest defence. And remember, a local minimum that generalises well beats a global minimum that memorised the training data." },
    { "startSec": 565, "text": "Next, a practical question: how much data do we use to compute each gradient? Batch gradient descent uses the whole training set for every step. The gradient is accurate, but each step is slow, and on a million examples that is unusable. Stochastic gradient descent uses one example per step. Each step is fast, but the gradient is noisy, so the path zigzags. Mini-batch gradient descent is the compromise almost everyone uses: a small batch, typically 32 or 64 examples, per step. The noise averages out enough to be stable, the steps are fast, and the work fits neatly on modern hardware. When you hear that a model trained for three epochs, that means it saw the whole training set three times, in mini-batches." },
    { "startSec": 640, "text": "One more failure mode before the fixes: overfitting. If you train too long, the model stops learning the pattern and starts memorising the training examples, including their noise. Training loss keeps falling while the loss on new data starts rising. That gap is the signal. The standard defences are simple. First, hold out a validation set and stop training when its loss stops improving; that is early stopping. Second, regularisation: add a penalty to the loss for large parameter values, which keeps the model simple. L2 regularisation, also called weight decay, is the usual default. Third, more data, when you can get it. None of these is clever. All of them work." },
    { "startSec": 700, "text": "Two small additions make gradient descent much better in practice, and then we are done. Momentum keeps a running average of past gradients and adds a fraction of it to each step, like a ball that has picked up speed: it rolls through small bumps and flat spots instead of stalling on them. And learning-rate schedules reduce the step size as training goes on, large steps early to make progress, small steps late to settle precisely. That is the whole picture. Learning is optimisation, the loss measures wrongness, the gradient points uphill so we step against it, the learning rate sets the step size, and the fixes are mini-batches, early stopping, regularisation, momentum, and schedules. Next lecture we will use this to train a real model. Thank you." }
  ],
  "notes": {
    "summary": "Training a model means minimising a loss function. Gradient descent does that by stepping against the gradient — the direction of steepest increase — with the step size set by the learning rate. Mini-batches, early stopping, regularisation, momentum and learning-rate schedules turn the basic rule into a training loop that works on real data.",
    "sections": [
      { "id": "s1", "heading": "Learning is optimisation", "startSec": 55, "endSec": 140,
        "points": [
          "Training = pick the model's numbers, measure how wrong it is, change the numbers to be less wrong, repeat.",
          "If you can measure wrongness with a single number, you can learn; if you cannot, you are guessing.",
          "The first job in a project is the measure, not the model."
        ],
        "definitions": [{ "term": "Optimisation", "meaning": "Finding the parameter values that make a measured quantity as small (or as large) as possible." }] },
      { "id": "s2", "heading": "The loss function", "startSec": 140, "endSec": 230,
        "points": [
          "Mean squared error: average of (prediction − true value)² over all examples.",
          "Squaring makes big errors count much more than small ones and keeps the loss positive; zero means perfect.",
          "Classification usually uses cross-entropy instead, but the idea is the same: one number, lower is better.",
          "Plotted against parameters, the loss forms a landscape with valleys; training is walking downhill on it."
        ],
        "definitions": [
          { "term": "Loss function", "meaning": "A single number measuring how wrong a model's predictions are. Lower is better." },
          { "term": "Mean squared error", "meaning": "The average of the squared differences between predictions and true values." }
        ] },
      { "id": "s3", "heading": "The gradient and the update rule", "startSec": 230, "endSec": 320,
        "points": [
          "The gradient is the slope of the loss at the current point, one slope per parameter, as a vector.",
          "It points uphill, in the direction where the loss rises fastest — so we step against it.",
          "Update rule: θ_new = θ_old − α · ∇Loss. That one line is the whole algorithm.",
          "Near the bottom the gradient is small, so steps shrink on their own and the method can settle."
        ],
        "definitions": [
          { "term": "Gradient", "meaning": "A vector of slopes of the loss, one per parameter, pointing in the direction of steepest increase." },
          { "term": "Learning rate (α)", "meaning": "The number that sets the size of each gradient-descent step." }
        ] },
      { "id": "s4", "heading": "The learning rate", "startSec": 320, "endSec": 490,
        "points": [
          "Too small: loss falls slowly and smoothly; training wastes time and compute.",
          "Too big: the update jumps over the valley and the loss oscillates or diverges; a sawtooth loss curve is the sign.",
          "Fix for divergence: cut the learning rate, often by a factor of ten.",
          "Common starting points are 0.01 or 0.001; adjust from what the loss curve shows, not from a rule book."
        ],
        "definitions": [{ "term": "Divergence", "meaning": "Training where the loss grows instead of falling, usually because the learning rate is too large." }] },
      { "id": "s5", "heading": "What goes wrong, and the fixes", "startSec": 490, "endSec": 720,
        "points": [
          "Local minima: gradient descent stops in the first valley it reaches. In high dimensions most traps are saddle points, and noise or a new random start usually escapes them.",
          "Batch gradient descent uses all data per step (accurate, slow); stochastic uses one example (fast, noisy); mini-batch (32 or 64) is the standard compromise.",
          "One epoch = one full pass over the training set, in mini-batches.",
          "Overfitting: training loss keeps falling while loss on new data rises. Defences: early stopping on a validation set, L2 regularisation (weight decay), more data.",
          "Momentum adds a fraction of past gradients to each step so training rolls through flat spots; learning-rate schedules shrink the step size late in training."
        ],
        "definitions": [
          { "term": "Local minimum", "meaning": "A valley in the loss landscape that is not the lowest point overall." },
          { "term": "Overfitting", "meaning": "A model that has memorised training examples, including their noise, and does badly on new data." },
          { "term": "Epoch", "meaning": "One complete pass over the whole training set." }
        ] }
    ]
  },
  "flashcards": [
    { "id": "f1", "front": "What is training, in one sentence?", "back": "Pick the model's numbers, measure how wrong it is, change the numbers to be less wrong, and repeat." },
    { "id": "f2", "front": "What does a loss function measure?", "back": "How wrong a model's predictions are, as a single number. Lower is better; zero is perfect." },
    { "id": "f3", "front": "What is mean squared error?", "back": "The average of (prediction − true value)² over all examples. Squaring makes big errors count much more than small ones." },
    { "id": "f4", "front": "Why is the loss squared instead of just averaged as-is?", "back": "Squaring keeps the loss positive and punishes large errors far more than small ones." },
    { "id": "f5", "front": "Which loss is usual for classification, and why not mean squared error?", "back": "Cross-entropy. The idea is the same — one number, lower is better — but it fits probabilities better than squared error." },
    { "id": "f6", "front": "What is the gradient?", "back": "A vector of slopes of the loss, one per parameter, pointing in the direction where the loss rises fastest — uphill." },
    { "id": "f7", "front": "Which way does the gradient point, and which way do we step?", "back": "The gradient points uphill, towards higher loss. Gradient descent steps against it, downhill." },
    { "id": "f8", "front": "Write the gradient descent update rule.", "back": "θ_new = θ_old − α · ∇Loss. New parameter = old parameter − learning rate × gradient of the loss." },
    { "id": "f9", "front": "What does the learning rate (α) control?", "back": "The size of each step. It is the number you tune most, and it decides whether training works at all." },
    { "id": "f10", "front": "What does a sawtooth loss curve mean?", "back": "The learning rate is almost certainly too big — updates are jumping over the valley and oscillating." },
    { "id": "f11", "front": "The loss falls fast, then jumps up, then falls again. What do you do?", "back": "Cut the learning rate, often by a factor of ten. That pattern is divergence from too-large steps." },
    { "id": "f12", "front": "Why do steps get smaller near the minimum without changing α?", "back": "Near the bottom the gradient itself is small, so α × gradient is small. Steps shrink on their own." },
    { "id": "f13", "front": "What is a local minimum, and why is it less of a disaster than it sounds?", "back": "A valley that is not the lowest point overall. In high dimensions most traps are saddle points, and noise or a new random start usually escapes them." },
    { "id": "f14", "front": "Batch vs stochastic vs mini-batch gradient descent?", "back": "Batch uses all data per step (accurate, slow). Stochastic uses one example (fast, noisy). Mini-batch uses 32 or 64 (the standard compromise)." },
    { "id": "f15", "front": "What is an epoch?", "back": "One complete pass over the whole training set, in mini-batches. Three epochs means the model saw all the data three times." },
    { "id": "f16", "front": "What is overfitting, and what is the signal?", "back": "The model memorises training examples, including noise. Training loss keeps falling while loss on new data starts rising — that gap is the signal." },
    { "id": "f17", "front": "Name three defences against overfitting.", "back": "Early stopping on a validation set, L2 regularisation (weight decay), and more data." },
    { "id": "f18", "front": "What is early stopping?", "back": "Hold out a validation set and stop training when its loss stops improving." },
    { "id": "f19", "front": "What is L2 regularisation (weight decay)?", "back": "A penalty added to the loss for large parameter values, which keeps the model simple." },
    { "id": "f20", "front": "What do momentum and learning-rate schedules do?", "back": "Momentum adds a fraction of past gradients to each step so training rolls through flat spots. Schedules shrink the step size late in training so it settles precisely." }
  ],
  "quiz": [
    { "id": "q1", "question": "What is the first job in a machine learning project, according to the lecture?", "options": ["Choosing the model architecture", "Defining a measure of wrongness (the loss)", "Collecting as much data as possible", "Picking the learning rate"], "correctIndex": 1, "explanation": "Training is only possible once wrongness is measured as a single number — the loss comes before the model.", "sourceSec": 55 },
    { "id": "q2", "question": "What is mean squared error?", "options": ["The largest single prediction error", "The average of the squared differences between predictions and true values", "The number of wrong predictions divided by the total", "The slope of the loss at the current point"], "correctIndex": 1, "explanation": "Take each prediction, subtract the true value, square it, and average over all examples.", "sourceSec": 140 },
    { "id": "q3", "question": "Which way does the gradient point?", "options": ["Downhill, towards lower loss", "Uphill, towards higher loss", "Towards the nearest local minimum", "It has no direction, only a size"], "correctIndex": 1, "explanation": "The gradient points in the direction where the loss rises fastest — uphill. Gradient descent steps against it.", "sourceSec": 230 },
    { "id": "q4", "question": "What is the gradient descent update rule?", "options": ["θ_new = θ_old + α · ∇Loss", "θ_new = θ_old − α · ∇Loss", "θ_new = θ_old × α ÷ ∇Loss", "θ_new = α − θ_old · ∇Loss"], "correctIndex": 1, "explanation": "New parameter = old parameter minus learning rate times gradient. The minus sign is what makes it descent.", "sourceSec": 230 },
    { "id": "q5", "question": "Your loss curve falls steeply, then jumps up, then falls, then jumps higher. What is wrong?", "options": ["The learning rate is too small", "The learning rate is too big", "The batch size is too small", "The model has too few parameters"], "correctIndex": 1, "explanation": "A sawtooth or rising loss is divergence from steps that jump over the valley. Cut the learning rate, often by ten.", "sourceSec": 410 },
    { "id": "q6", "question": "Why do gradient descent steps shrink near the minimum even if α never changes?", "options": ["The learning rate decays automatically", "The gradient itself becomes small near the bottom", "The loss function changes shape", "Momentum cancels the steps out"], "correctIndex": 1, "explanation": "Step size is α × gradient, and the gradient is small near a minimum, so steps get small on their own.", "sourceSec": 410 },
    { "id": "q7", "question": "What is the standard compromise for how much data to use per gradient step?", "options": ["The whole training set every step", "One example per step", "A mini-batch of 32 or 64 examples", "Half the training set every step"], "correctIndex": 2, "explanation": "Mini-batch gradient descent: fast steps, noise averaged out enough to be stable, and it fits modern hardware.", "sourceSec": 565 },
    { "id": "q8", "question": "Training loss keeps falling but loss on new data starts rising. What is happening?", "options": ["Underfitting", "Divergence", "Overfitting", "A saddle point"], "correctIndex": 2, "explanation": "That gap is the signal of overfitting: the model is memorising training examples, including their noise.", "sourceSec": 640 },
    { "id": "q9", "question": "Which of these is NOT named in the lecture as a defence against overfitting?", "options": ["Early stopping on a validation set", "L2 regularisation (weight decay)", "More data", "Dropping the learning rate to zero"], "correctIndex": 3, "explanation": "The three defences named are early stopping, L2 regularisation, and more data. A zero learning rate stops learning entirely.", "sourceSec": 640 },
    { "id": "q10", "question": "What does momentum do in gradient descent?", "options": ["It increases the learning rate every step", "It adds a fraction of past gradients to each step, so training rolls through flat spots", "It shuffles the training data each epoch", "It stops training when validation loss rises"], "correctIndex": 1, "explanation": "Momentum keeps a running average of past gradients — like a ball that has picked up speed — and adds a fraction of it to each step.", "sourceSec": 700 }
  ],
  "mindmap": {
    "id": "root", "label": "Gradient descent", "startSec": 0, "children": [
      { "id": "m1", "label": "Learning as optimisation", "startSec": 55, "children": [
        { "id": "m1a", "label": "Measure wrongness first", "startSec": 55, "children": [] },
        { "id": "m1b", "label": "Change numbers to be less wrong", "startSec": 55, "children": [] },
        { "id": "m1c", "label": "Repeat", "startSec": 55, "children": [] }
      ] },
      { "id": "m2", "label": "Loss function", "startSec": 140, "children": [
        { "id": "m2a", "label": "Mean squared error", "startSec": 140, "children": [] },
        { "id": "m2b", "label": "Cross-entropy for classification", "startSec": 140, "children": [] },
        { "id": "m2c", "label": "Loss landscape: valleys", "startSec": 140, "children": [] }
      ] },
      { "id": "m3", "label": "Update rule", "startSec": 230, "children": [
        { "id": "m3a", "label": "Gradient points uphill", "startSec": 230, "children": [] },
        { "id": "m3b", "label": "θ_new = θ_old − α · ∇Loss", "startSec": 230, "children": [] },
        { "id": "m3c", "label": "Steps shrink near the bottom", "startSec": 410, "children": [] }
      ] },
      { "id": "m4", "label": "Learning rate", "startSec": 320, "children": [
        { "id": "m4a", "label": "Too small: slow, wastes compute", "startSec": 410, "children": [] },
        { "id": "m4b", "label": "Too big: oscillates, diverges", "startSec": 410, "children": [] },
        { "id": "m4c", "label": "Start 0.01 or 0.001", "startSec": 320, "children": [] }
      ] },
      { "id": "m5", "label": "Training in practice", "startSec": 490, "children": [
        { "id": "m5a", "label": "Mini-batches of 32 or 64", "startSec": 565, "children": [] },
        { "id": "m5b", "label": "Overfitting: early stopping, L2", "startSec": 640, "children": [] },
        { "id": "m5c", "label": "Momentum + schedules", "startSec": 700, "children": [] }
      ] }
    ]
  },
  "quizBest": 0
};
if (typeof module !== "undefined") module.exports = SAMPLE_LECTURE;
