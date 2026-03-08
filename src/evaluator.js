const OPERATOR_INFO = {
    '+': {precedence: 2, associativity: 'left', arity: 2},
    '-': {precedence: 2, associativity: 'left', arity: 2},
    '*': {precedence: 3, associativity: 'left', arity: 2},
    '/': {precedence: 3, associativity: 'left', arity: 2},
    '%': {precedence: 3, associativity: 'left', arity: 2},
    '^': {precedence: 4, associativity: 'right', arity: 2},
    'u-': {precedence: 5, associativity: 'right', arity: 1},
};

const CONSTANTS = new Map([
    ['pi', Math.PI],
    ['e', Math.E],
]);

const FUNCTIONS = new Set([
    'sin',
    'cos',
    'tan',
    'asin',
    'acos',
    'atan',
    'sqrt',
    'abs',
    'ln',
    'log',
    'floor',
    'ceil',
    'round',
]);

export class ExpressionEvaluator {
    constructor(options = {}) {
        this._angleUnit = options.angleUnit ?? 'degrees';
    }

    setAngleUnit(unit) {
        this._angleUnit = unit === 'radians' ? 'radians' : 'degrees';
    }

    evaluate(expression) {
        if (!expression || !expression.trim())
            throw new Error('Empty expression');

        const tokens = this._tokenize(expression);
        const rpn = this._toRpn(tokens);
        return this._evaluateRpn(rpn);
    }

    format(value, decimalPlaces) {
        if (!Number.isFinite(value))
            throw new Error('Result is not finite');

        if (Math.abs(value) >= 1e12 || (Math.abs(value) > 0 && Math.abs(value) < 1e-9))
            return value.toExponential(Math.min(decimalPlaces, 12));

        const fixed = value.toFixed(decimalPlaces);
        return fixed
            .replace(/(\.\d*?[1-9])0+$/u, '$1')
            .replace(/\.0+$/u, '');
    }

    _tokenize(source) {
        const tokens = [];
        let i = 0;

        while (i < source.length) {
            const ch = source[i];

            if (/\s/u.test(ch)) {
                i++;
                continue;
            }

            if (/[0-9.]/u.test(ch)) {
                let numberText = '';
                let dotCount = 0;
                while (i < source.length && /[0-9.]/u.test(source[i])) {
                    if (source[i] === '.')
                        dotCount++;
                    numberText += source[i];
                    i++;
                }

                if (dotCount > 1 || numberText === '.')
                    throw new Error('Invalid number format');

                if (i < source.length && /[eE]/u.test(source[i])) {
                    numberText += source[i];
                    i++;

                    if (i < source.length && /[+-]/u.test(source[i])) {
                        numberText += source[i];
                        i++;
                    }

                    let expDigits = '';
                    while (i < source.length && /[0-9]/u.test(source[i])) {
                        expDigits += source[i];
                        i++;
                    }

                    if (!expDigits)
                        throw new Error('Invalid scientific notation');

                    numberText += expDigits;
                }

                tokens.push({type: 'number', value: Number.parseFloat(numberText)});
                continue;
            }

            if (/[A-Za-z]/u.test(ch)) {
                let identifier = '';
                while (i < source.length && /[A-Za-z]/u.test(source[i])) {
                    identifier += source[i];
                    i++;
                }
                tokens.push({type: 'identifier', value: identifier.toLowerCase()});
                continue;
            }

            if ('+-*/%^'.includes(ch)) {
                tokens.push({type: 'operator', value: ch});
                i++;
                continue;
            }

            if (ch === '(') {
                tokens.push({type: 'leftParen', value: ch});
                i++;
                continue;
            }

            if (ch === ')') {
                tokens.push({type: 'rightParen', value: ch});
                i++;
                continue;
            }

            if (ch === ',') {
                tokens.push({type: 'comma', value: ch});
                i++;
                continue;
            }

            throw new Error(`Unexpected character: ${ch}`);
        }

        for (let idx = 0; idx < tokens.length; idx++) {
            const token = tokens[idx];
            if (token.type !== 'operator' || token.value !== '-')
                continue;

            const previous = tokens[idx - 1];
            const unary = !previous ||
                previous.type === 'operator' ||
                previous.type === 'leftParen' ||
                previous.type === 'comma';
            if (unary)
                token.value = 'u-';
        }

        return tokens;
    }

    _toRpn(tokens) {
        const output = [];
        const stack = [];

        for (const token of tokens) {
            if (token.type === 'number') {
                output.push(token);
                continue;
            }

            if (token.type === 'identifier') {
                if (CONSTANTS.has(token.value)) {
                    output.push({type: 'number', value: CONSTANTS.get(token.value)});
                } else if (FUNCTIONS.has(token.value)) {
                    stack.push({type: 'function', value: token.value});
                } else {
                    throw new Error(`Unknown identifier: ${token.value}`);
                }
                continue;
            }

            if (token.type === 'operator') {
                while (stack.length > 0) {
                    const top = stack[stack.length - 1];
                    if (top.type !== 'operator')
                        break;

                    const currentInfo = OPERATOR_INFO[token.value];
                    const topInfo = OPERATOR_INFO[top.value];
                    const shouldPop = currentInfo.associativity === 'left'
                        ? currentInfo.precedence <= topInfo.precedence
                        : currentInfo.precedence < topInfo.precedence;
                    if (!shouldPop)
                        break;

                    output.push(stack.pop());
                }
                stack.push(token);
                continue;
            }

            if (token.type === 'leftParen') {
                stack.push(token);
                continue;
            }

            if (token.type === 'rightParen') {
                let foundLeftParen = false;
                while (stack.length > 0) {
                    const top = stack.pop();
                    if (top.type === 'leftParen') {
                        foundLeftParen = true;
                        break;
                    }
                    output.push(top);
                }

                if (!foundLeftParen)
                    throw new Error('Mismatched parentheses');

                const maybeFunc = stack[stack.length - 1];
                if (maybeFunc && maybeFunc.type === 'function')
                    output.push(stack.pop());

                continue;
            }

            if (token.type === 'comma') {
                while (stack.length > 0 && stack[stack.length - 1].type !== 'leftParen')
                    output.push(stack.pop());
                if (stack.length === 0)
                    throw new Error('Invalid function argument separator');
            }
        }

        while (stack.length > 0) {
            const top = stack.pop();
            if (top.type === 'leftParen' || top.type === 'rightParen')
                throw new Error('Mismatched parentheses');
            output.push(top);
        }

        return output;
    }

    _evaluateRpn(rpn) {
        const stack = [];

        for (const token of rpn) {
            if (token.type === 'number') {
                stack.push(token.value);
                continue;
            }

            if (token.type === 'operator') {
                const info = OPERATOR_INFO[token.value];
                if (stack.length < info.arity)
                    throw new Error('Invalid expression');

                if (info.arity === 1) {
                    const operand = stack.pop();
                    stack.push(-operand);
                    continue;
                }

                const right = stack.pop();
                const left = stack.pop();
                stack.push(this._applyOperator(token.value, left, right));
                continue;
            }

            if (token.type === 'function') {
                if (stack.length < 1)
                    throw new Error('Invalid function call');
                const value = stack.pop();
                stack.push(this._applyFunction(token.value, value));
                continue;
            }

            throw new Error('Invalid token while evaluating');
        }

        if (stack.length !== 1)
            throw new Error('Invalid expression');

        const result = stack[0];
        if (!Number.isFinite(result))
            throw new Error('Result is not finite');
        return result;
    }

    _applyOperator(op, left, right) {
        switch (op) {
        case '+':
            return left + right;
        case '-':
            return left - right;
        case '*':
            return left * right;
        case '/':
            if (right === 0)
                throw new Error('Division by zero');
            return left / right;
        case '%':
            if (right === 0)
                throw new Error('Division by zero');
            return left % right;
        case '^':
            return Math.pow(left, right);
        default:
            throw new Error(`Unsupported operator: ${op}`);
        }
    }

    _applyFunction(name, value) {
        switch (name) {
        case 'sin':
            return Math.sin(this._toRadians(value));
        case 'cos':
            return Math.cos(this._toRadians(value));
        case 'tan':
            return Math.tan(this._toRadians(value));
        case 'asin':
            return this._fromRadians(Math.asin(value));
        case 'acos':
            return this._fromRadians(Math.acos(value));
        case 'atan':
            return this._fromRadians(Math.atan(value));
        case 'sqrt':
            if (value < 0)
                throw new Error('Cannot sqrt a negative number');
            return Math.sqrt(value);
        case 'abs':
            return Math.abs(value);
        case 'ln':
            if (value <= 0)
                throw new Error('ln input must be positive');
            return Math.log(value);
        case 'log':
            if (value <= 0)
                throw new Error('log input must be positive');
            return Math.log10(value);
        case 'floor':
            return Math.floor(value);
        case 'ceil':
            return Math.ceil(value);
        case 'round':
            return Math.round(value);
        default:
            throw new Error(`Unsupported function: ${name}`);
        }
    }

    _toRadians(value) {
        if (this._angleUnit === 'degrees')
            return value * (Math.PI / 180);
        return value;
    }

    _fromRadians(value) {
        if (this._angleUnit === 'degrees')
            return value * (180 / Math.PI);
        return value;
    }
}
