import * as CST from '../visitor/CST.js';

/**
 * @typedef {import('../visitor/Visitor.js').default<string>} Visitor
 */
/**
 * @implements {Visitor}
 */
export default class FortranTranslator {
    /**
     * @param {CST.Producciones} node
     * @this {Visitor}
     */
    visitProducciones(node) {
        return `
        function peg_${node.id}() result(accept)
            logical :: accept
            integer :: i

            accept = .false.
            ${node.expr.accept(this)}
            ${
                node.start
                    ? `
                    if (.not. acceptEOF()) then
                        return
                    end if
                    `
                    : ''
            }
            accept = .true.
        end function peg_${node.id}
        `;
    }
    /**
     * @param {CST.Opciones} node
     * @this {Visitor}
     */
    visitOpciones(node) {
        const template = `
        do i = 0, ${node.exprs.length}
            select case(i)
                ${node.exprs
                    .map(
                        (expr, i) => `
                        case(${i})
                            ${expr.accept(this)}
                            exit
                        `
                    )
                    .join('\n')}
            case default
                return
            end select
        end do
        `;
        return template;
    }
    /**
     * @param {CST.Union} node
     * @this {Visitor}
     */
    visitUnion(node) {
        return node.exprs.map((expr) => expr.accept(this)).join('\n');
    }
    /**
     * @param {CST.Expresion} node
     * @this {Visitor}
     */
    visitExpresion(node) {
        const condition = node.expr.accept(this);
        switch (node.qty) {
            case '+':
                return `
                if (.not. (${condition})) then
                    cycle
                end if
                do while (.not. cursor > len(input))
                    if (.not. (${condition})) then
                        exit
                    end if
                end do
                `;

            case '*':
                return `
                do while (.not. cursor > len(input))
                    if (.not. (${condition})) then
                        exit
                    end if
                end do
                `;

            case '?':
                return `
                if (.not. (${condition})) then
                    
                end if
                `;
            default:
                return `
                if (.not. (${condition})) then
                    cycle
                end if
                `;
        }
    }
    /**
     * @param {CST.String} node
     * @this {Visitor}
     */
    visitString(node) {
        return `acceptString('${node.val}')`;
    }
    

    /**
     * @param {CST.Corchetes} node
     * @this {Visitor}
     */
    visitCorchetes(node) {
        let characterClass = [];
        const literales = node.chars
        .filter((char) => char instanceof CST.literalRango)
        .map((char) => char.accept(this));

        const ranges = node.chars
        .filter((char) => char instanceof CST.rango)
        .map((char) => char.accept(this));

        if (literales.length !== 0) {
            characterClass = [`acceptSet([ ${literales.join(',')} ])`];
        }
        if (ranges.length !== 0) {
            characterClass = [...characterClass, ...ranges];
        }

        return characterClass.join(' .or. ');

    }

    /**
     * @param {CST.rango} node
     * @this {Visitor}
     */
    visitrango(node) {
        return `acceptRange('${node.bottom}', '${node.top}')`;
    }

    /**
     * @param {CST.literalRango} node
     * @this {Visitor}
     */

    visitliteralRango(node) {
        return "'"+node.val+"'";
    }

    /**
     * @param {CST.identificador} node
     * @this {Visitor}
     */
    visitidentificador(node) {
        return `peg_${node.id}()`;
    }
    /**
     * @param {CST.Any} node
     * @this {Visitor}
     */
    visitAny(node) {
        return 'acceptPeriod()';
    }
    /**
     * @param {CST.finCadena} node
     * @this {Visitor}
     */
    visitfinCadena(node) {
        return 'acceptEOF()';
    }
}
