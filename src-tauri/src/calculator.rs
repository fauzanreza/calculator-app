use std::str::FromStr;

#[derive(Debug, Clone, PartialEq)]
enum Token {
    Num(f64),
    Plus,
    Minus,
    Star,
    Slash,
    Percent,
    Caret,
    Fact,
    LParen,
    RParen,
    Func(String),
}

fn tokenize(expr: &str) -> Result<Vec<Token>, String> {
    let mut tokens = Vec::new();
    let mut chars = expr.chars().peekable();

    while let Some(&c) = chars.peek() {
        if c.is_whitespace() {
            chars.next();
        } else if c.is_ascii_digit() || c == '.' {
            let mut num_str = String::new();
            while let Some(&n) = chars.peek() {
                if n.is_ascii_digit() || n == '.' {
                    num_str.push(n);
                    chars.next();
                } else {
                    break;
                }
            }
            if let Ok(num) = f64::from_str(&num_str) {
                tokens.push(Token::Num(num));
            } else {
                return Err(format!("Invalid number: {}", num_str));
            }
        } else if c.is_ascii_alphabetic() {
            let mut word = String::new();
            while let Some(&l) = chars.peek() {
                if l.is_ascii_alphabetic() {
                    word.push(l);
                    chars.next();
                } else {
                    break;
                }
            }
            match word.as_str() {
                "pi" | "π" => tokens.push(Token::Num(std::f64::consts::PI)),
                "e" => tokens.push(Token::Num(std::f64::consts::E)),
                _ => tokens.push(Token::Func(word)),
            }
        } else {
            match c {
                '+' => tokens.push(Token::Plus),
                '-' | '−' => tokens.push(Token::Minus),
                '*' | '×' | '∗' | '⋅' => tokens.push(Token::Star),
                '/' | '÷' => tokens.push(Token::Slash),
                '%' => tokens.push(Token::Percent),
                '^' => tokens.push(Token::Caret),
                '!' => tokens.push(Token::Fact),
                '(' => tokens.push(Token::LParen),
                ')' => tokens.push(Token::RParen),
                _ => return Err(format!("Unknown character: {}", c)),
            }
            chars.next();
        }
    }
    Ok(tokens)
}

struct Parser {
    tokens: Vec<Token>,
    pos: usize,
}

impl Parser {
    fn new(tokens: Vec<Token>) -> Self {
        Self { tokens, pos: 0 }
    }

    fn peek(&self) -> Option<&Token> {
        self.tokens.get(self.pos)
    }

    fn advance(&mut self) -> Option<&Token> {
        let t = self.tokens.get(self.pos);
        self.pos += 1;
        t
    }

    fn parse_expression(&mut self) -> Result<f64, String> {
        self.parse_term()
    }

    fn parse_term(&mut self) -> Result<f64, String> {
        let mut value = self.parse_factor()?;
        while let Some(tok) = self.peek() {
            match tok {
                Token::Plus => {
                    self.advance();
                    value += self.parse_factor()?;
                }
                Token::Minus => {
                    self.advance();
                    value -= self.parse_factor()?;
                }
                _ => break,
            }
        }
        Ok(value)
    }

    fn parse_factor(&mut self) -> Result<f64, String> {
        let mut value = self.parse_power()?;
        while let Some(tok) = self.peek() {
            match tok {
                Token::Star => {
                    self.advance();
                    value *= self.parse_power()?;
                }
                Token::Slash => {
                    self.advance();
                    let denom = self.parse_power()?;
                    if denom == 0.0 { return Err("Error: ÷ 0".to_string()); }
                    value /= denom;
                }
                Token::Percent => {
                    self.advance();
                    let denom = self.parse_power()?;
                    if denom == 0.0 { return Err("Error: mod 0".to_string()); }
                    value %= denom;
                }
                Token::LParen | Token::Func(_) | Token::Num(_) => {
                    // Implicit multiplication (e.g., 2(3) -> 2*3, 2log(8) -> 2*log(8), 2 3 -> 2*3)
                    value *= self.parse_power()?;
                }
                _ => break,
            }
        }
        Ok(value)
    }

    fn parse_power(&mut self) -> Result<f64, String> {
        let mut value = self.parse_postfix()?;
        while let Some(tok) = self.peek() {
            if let Token::Caret = tok {
                self.advance();
                let exponent = self.parse_postfix()?;
                value = value.powf(exponent);
                if value.is_nan() || value.is_infinite() {
                    return Err("Error: Invalid operation".to_string());
                }
            } else {
                break;
            }
        }
        Ok(value)
    }

    fn parse_postfix(&mut self) -> Result<f64, String> {
        let mut value = self.parse_primary()?;
        while let Some(tok) = self.peek() {
            if let Token::Fact = tok {
                self.advance();
                if value < 0.0 || value.fract() != 0.0 || value > 170.0 {
                    return Err("Error: Invalid factorial".to_string());
                }
                let mut res = 1.0;
                for i in 1..=(value as u64) {
                    res *= i as f64;
                }
                value = res;
            } else {
                break;
            }
        }
        Ok(value)
    }

    fn parse_primary(&mut self) -> Result<f64, String> {
        match self.advance() {
            Some(Token::Num(n)) => Ok(*n),
            Some(Token::Minus) => {
                let v = self.parse_primary()?;
                Ok(-v)
            }
            Some(Token::Plus) => self.parse_primary(),
            Some(Token::LParen) => {
                let v = self.parse_expression()?;
                if let Some(Token::RParen) = self.advance() {
                    Ok(v)
                } else {
                    // Try to auto-close parens if missing at EOF for convenience
                    Ok(v)
                }
            }
            Some(Token::Func(name)) => {
                let name = name.clone();
                // Check if followed by LParen
                let has_paren = match self.peek() {
                    Some(Token::LParen) => {
                        self.advance();
                        true
                    }
                    _ => false,
                };
                let v = if has_paren {
                    let v = self.parse_expression()?;
                    if let Some(Token::RParen) = self.peek() {
                        self.advance();
                    }
                    v
                } else {
                    self.parse_primary()?
                };

                match name.as_str() {
                    "sin" => Ok(v.to_radians().sin()),
                    "cos" => Ok(v.to_radians().cos()),
                    "tan" => {
                        if v % 180.0 == 90.0 || v % 180.0 == -90.0 {
                            Err("Error: Undefined".to_string())
                        } else {
                            Ok(v.to_radians().tan())
                        }
                    }
                    "asin" => if v < -1.0 || v > 1.0 { Err("Error: Domain".to_string()) } else { Ok(v.asin().to_degrees()) },
                    "acos" => if v < -1.0 || v > 1.0 { Err("Error: Domain".to_string()) } else { Ok(v.acos().to_degrees()) },
                    "atan" => Ok(v.atan().to_degrees()),
                    "log" => if v <= 0.0 { Err("Error: Invalid log".to_string()) } else { Ok(v.log10()) },
                    "ln" => if v <= 0.0 { Err("Error: Invalid ln".to_string()) } else { Ok(v.ln()) },
                    "sqrt" => if v < 0.0 { Err("Error: Complex root".to_string()) } else { Ok(v.sqrt()) },
                    "cbrt" => Ok(v.cbrt()),
                    "abs" => Ok(v.abs()),
                    _ => Err(format!("Unknown function: {}", name)),
                }
            }
            _ => Err("Error: Syntax".to_string()),
        }
    }
}

pub fn evaluate_expression(expr: &str) -> Result<f64, String> {
    if expr.trim().is_empty() {
        return Ok(0.0);
    }
    let tokens = tokenize(expr)?;
    let mut parser = Parser::new(tokens);
    let result = parser.parse_expression()?;
    // If there are leftovers, it might be a syntax error, but we can ignore it for calculator flexibility
    Ok(result)
}

pub fn format_result(value: f64) -> String {
    if value.is_nan() {
        return "Error: NaN".to_string();
    }
    if value.is_infinite() {
        return if value > 0.0 { "∞".to_string() } else { "-∞".to_string() };
    }
    let rounded = (value * 1e10).round() / 1e10;
    if rounded.fract() == 0.0 && rounded.abs() < 1e15 {
        return format!("{}", rounded as i64);
    }
    let formatted = format!("{:.10}", value);
    let trimmed = formatted.trim_end_matches('0').trim_end_matches('.');
    trimmed.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test] fn test_add() { assert_eq!(evaluate_expression("1 + 2").unwrap(), 3.0); }
    #[test] fn test_order() { assert_eq!(evaluate_expression("2 + 3 * 4").unwrap(), 14.0); }
    #[test] fn test_parens() { assert_eq!(evaluate_expression("(2 + 3) * 4").unwrap(), 20.0); }
    #[test] fn test_func() { assert_eq!(evaluate_expression("sin(90)").unwrap(), 1.0); }
    #[test] fn test_pow() { assert_eq!(evaluate_expression("2^3").unwrap(), 8.0); }
}

