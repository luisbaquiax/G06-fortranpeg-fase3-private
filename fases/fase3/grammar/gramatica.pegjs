{{
    import { ids, usos} from '../index.js'
    import { ErrorReglas } from './error.js';
    import { errores } from '../index.js'
    
    import * as n from '../visitor/CST.js';





}}

gramatica
  = _ code:globalCode? _ prods:producciones+ _ {
    let duplicados = ids.filter((item, index) => ids.indexOf(item) !== index);
    if (duplicados.length > 0) {
        errores.push(new ErrorReglas("Regla duplicada: " + duplicados[0]));
    }

    // Validar que todos los usos están en ids
    let noEncontrados = usos.filter(item => !ids.includes(item));
    if (noEncontrados.length > 0) {
        errores.push(new ErrorReglas("Regla no encontrada: " + noEncontrados[0]));
    }
    prods[0].start = true;
    return new n.Grammar(prods, code);
  }

globalCode
  = "{" before:$(. !"contains")* [ \t\n\r]* "contains" [ \t\n\r]* after:$[^}]* "}" {
    return after ? {before, after} : {before}
  }

producciones
  = _ id:identificador _ alias:$(literales)? _ "=" _ expr:opciones (_";")? {
    ids.push(id);
    return new n.Producciones(id, expr, alias);
  }

opciones
  = expr:union rest:(_ "/" _ @union)* {
    return new n.Opciones([expr, ...rest]);
  }

union
  = expr:parsingExpression rest:(_ @parsingExpression !(_ literales? _ "=") )* action:(_ @predicate)? {
    const exprs = [expr, ...rest];
    const labeledExprs = exprs
        .filter((expr) => expr instanceof n.Pluck)
        .filter((expr) => expr.labeledExpr.label);
    if (labeledExprs.length > 0) {
        action.params = labeledExprs.reduce((args, labeled) => {
            const expr = labeled.labeledExpr.annotatedExpr.expr;
            args[labeled.labeledExpr.label] =
                expr instanceof n.Identificador ? expr.id : '';
            return args;
        }, {});
    }
    return new n.Union(exprs, action);
  }

parsingExpression
  = pluck
  / '!' assertion:(match/predicate) {
    return new n.NegAssertion(assertion);
  }
  / '&' assertion:(match/predicate) {
    return new n.Assertion(assertion);
  }
  / "!." {
    return new n.FinCadena();
  }

pluck
  = pluck:"@"? _ expr:label {
    return new n.Pluck(expr, pluck ? true : false);
  }

label
  = label:(@identificador _ ":")? _ expr:annotated {
    return new n.Label(expr, label);
  }

  annotated
  = text:"$"? _ expr:match _ qty:([?+*]/conteo)? {
    return new n.Annotated(expr, qty, text ? true : false);
  }

match
  = id:identificador {
    usos.push(id);
    return new n.Identificador(id);
  }
  / val:$literales isCase:"i"? {
    return new n.String(val.replace(/['"]/g, ''), isCase? true : false);
  }
  / "(" _ opciones:opciones _ ")"{
    return new n.Grupo(opciones);
  }

  / exprs:corchetes isCase:"i"?{
    //console.log("Corchetes", exprs);
    return new n.Corchetes(exprs, isCase? true : false);

  }
  / "." {
    return new n.Any();
  }

// conteo = "|" parteconteo _ (_ delimitador )? _ "|"

conteo = "|" _ expr: (numero / identificadorDelimiter) _ "|" {
               return new n.DelimiterCount(expr);
          }
        / "|" _ expr_1:(numero / id:identificador)? _ ".." _ expr_2:(numero / id2:identificador)? _ "|"{
                return new n.DelimiterMinMax(expr_1, expr_2);
        }
                
        / "|" _ expr:(numero / id:identificador)? _ "," _ opcion:(match) _ "|"{
                return new n.DelimiterCount(expr, opcion);
        }
        / "|" _ expr_1:(numero / id:identificador)? _ ".." _ expr_2:(numero / id2:identificador)? _ "," _ opcion:(match) _ "|"{
                return new n.DelimiterMinMax(expr_1, expr_2, opcion);
        }

predicate
  = "{" [ \t\n\r]* returnType:predicateReturnType code:$[^}]* "}" {
    return new n.Predicate(returnType, code, {})
  }

  predicateReturnType
  = t:$(. !"::")+ [ \t\n\r]* "::" [ \t\n\r]* "res" {
    return t.trim();
  }

// Regla principal que analiza corchetes con contenido
corchetes
    = "[" contenido:(rango / contenido)+ "]" {
        return contenido;
    }

// Regla para validar un rango como [A-Z]
rango
    = inicio:$caracter "-" fin:$caracter {
        return new  n.Rango(inicio, fin);
    }

// Regla para caracteres individuales
caracter
    = [a-zA-Z0-9_ ] 

// Coincide con cualquier contenido que no incluya "]"
contenido
    = contenido: (corchete / @$texto){
        return new n.LiteralRango(contenido);
    }

corchete
    = "[" contenido "]"

texto
    = "\\" escape
    /[^\[\]]

literales
  = '"' @stringDobleComilla* '"'
  / "'" @stringSimpleComilla* "'"

stringDobleComilla = !('"' / "\\" / finLinea) .
                    / "\\" escape
                    / continuacionLinea

stringSimpleComilla = !("'" / "\\" / finLinea) .
                    / "\\" escape
                    / continuacionLinea

continuacionLinea = "\\" secuenciaFinLinea

finLinea = [\n\r\u2028\u2029]

escape = "'"
        / '"'
        / "\\"
        / "b"
        / "f"
        / "n"
        / "r"
        / "t"
        / "v"
        / "u"

secuenciaFinLinea = "\r\n" / "\n" / "\r" / "\u2028" / "\u2029"

// literales = 
//     "\"" [^"]* "\""
//     / "'" [^']* "'"
    

numero = [0-9]+{
    return new n.NumberDelimiter( text());
}

identificador = [_a-z]i[_a-z0-9]i* { return text() }

identificadorDelimiter =  [_a-z]i[_a-z0-9]i* { return new n.Identificador(text())}

_ = (Comentarios /[ \t\n\r])*


Comentarios = 
    "//" [^\n]* 
    / "/*" (!"*/" .)* "*/"