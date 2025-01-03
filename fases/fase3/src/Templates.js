/**
 *
 * @param {{
 *  beforeContains: string
 *  afterContains: string
 *  startingRuleId: string;
 *  startingRuleType: string;
 *  rules: string[];
 *  actions: string[];
 *  groups: string[];
 * }} data
 * @returns {string}
 */
export const main = (data) => `
!auto-generated
module parser
    implicit none
    character(len=:), allocatable, private :: input
    integer, private :: savePoint, lexemeStart, cursor
    character(len=:), allocatable :: msgError
	logical:: isError = .false.

    interface toStr
        module procedure intToStr
        module procedure strToStr
    end interface
    
    ${data.beforeContains}

    contains
    
    ${data.afterContains}

    function parse(str) result(res)
        character(len=:), allocatable :: str
        ${data.startingRuleType} :: res

        input = str
        cursor = 1

        res = ${data.startingRuleId}()
        if (isError )then
		    call pegStopError()
		end if 
        
    end function parse

    ${data.rules.join('\n')}

    ${data.actions.join('\n')}

    ${data.groups.join('\n')}

    function acceptString(str, isCase) result(accept)
        character(len=*) :: str
        integer :: isCase
        logical :: accept
        integer :: offset

        offset = len(str) - 1

        if (isCase == 0) then
            if (str /= input(cursor:cursor + offset)) then
                accept = .false.
                return
            end if
        else if (isCase == 1) then
            if (tolower(str) /= tolower(input(cursor:cursor + offset))) then
                accept = .false.
                return
            end if
        end if
        cursor = cursor + len(str)
        accept = .true.
    end function acceptString

    function acceptRange(bottom, top, isCase) result(accept)
        character(len=1) :: bottom, top
        integer :: isCase
        logical :: accept

        if (isCase == 0) then

            if(.not. (input(cursor:cursor) >= bottom .and. input(cursor:cursor) <= top)) then
                accept = .false.
                return
            end if
        else if (isCase == 1) then
            if(.not. (tolower(input(cursor:cursor)) >= tolower(bottom) .and. tolower(input(cursor:cursor)) <= tolower(top))) then
                accept = .false.
                return
            end if
        end if
        cursor = cursor + 1
        accept = .true.
    end function acceptRange

    function acceptSet(set, isCase) result(accept)
        character(len=1), dimension(:) :: set
        integer :: isCase
        logical :: accept

        if(isCase == 0) then
            if(.not. (findloc(set, input(cursor:cursor), 1) > 0)) then
                accept = .false.
                return
            end if
        else if (isCase == 1) then
            if(.not. (findloc(set, tolower(input(cursor:cursor)), 1) > 0)) then
                accept = .false.
                return
            end if
        end if
        cursor = cursor + 1
        accept = .true.
    end function acceptSet

    function acceptPeriod() result(accept)
        logical :: accept

        if (cursor > len(input)) then
            accept = .false.
            return
        end if
        cursor = cursor + 1
        accept = .true.
    end function acceptPeriod

    function acceptEOF() result(accept)
        logical :: accept

        if(.not. cursor > len(input)) then
            accept = .false.
            return
        end if
        accept = .true.
    end function acceptEOF

    function consumeInput() result(substr)
        character(len=:), allocatable :: substr

        substr = input(lexemeStart:cursor - 1)
    end function consumeInput

    subroutine pegError()
		msgError = "Error en la linea " // intToStr(cursor) // ": No se esperaba ->'"//input(cursor:cursor)//"'"
		isError = .true.
    end subroutine pegError
	
	subroutine pegStopError()
		STOP msgError
	end subroutine

    function intToStr(int) result(cast)
        integer :: int
        character(len=31) :: tmp
        character(len=:), allocatable :: cast

        write(tmp, '(I0)') int
        cast = trim(adjustl(tmp))
    end function intToStr

    function StringToInt(str) result(result)
        implicit none
        character(LEN=*), intent(IN) :: str
        integer :: result
        integer :: ioStatus

        result = 0

        read(str, *, IOSTAT=ioStatus) result

    end function StringToInt


    function strToStr(str) result(cast)
        character(len=:), allocatable :: str
        character(len=:), allocatable :: cast

        cast = str
    end function strToStr

    function tolower(str) result(lower_str)
        character(len=*), intent(in) :: str
        character(len=len(str)) :: lower_str
        integer :: i

        lower_str = str 
        do i = 1, len(str)
            if (iachar(str(i:i)) >= iachar('A') .and. iachar(str(i:i)) <= iachar('Z')) then
                lower_str(i:i) = achar(iachar(str(i:i)) + 32)
            end if
        end do
    end function tolower
end module parser
`;

/**
 *
 * @param {{
 *  id: string;
 *  returnType: string;
 *  exprDeclarations: string[];
 *  delimiterIndex: string[];
 *  expr: string;
 * }} data
 * @returns
 */
export const rule = (data) => `
    function peg_${data.id}() result (res)
        ${data.returnType} :: res
        ${data.exprDeclarations.join('\n')}
        ${data.delimiterIndex.join('\n')}
        character(len=:), allocatable :: tmp
        logical :: skipCase = .false.
        integer :: i

        savePoint = cursor
        ${data.expr}
    end function peg_${data.id}
`;

/**
 *
 * @param {{
 *  exprs: string[]
 * }} data
 * @returns
 */
export const election = (data) => `
        do i = 0, ${data.exprs.length}
            select case(i)
            ${data.exprs.map(
                (expr, i) => `
            case(${i})
                isError = .false.
                skipCase = .false.
                cursor = savePoint
                ${expr}
                exit
            `
            ).join('')}
            case default
                    call pegError()
            end select
        end do
`;

/**
 *
 * @param {{
 *  exprs: string[]
 *  startingRule: boolean
 *  resultExpr: string
 * }} data
 * @returns
 */
export const union = (data) => `
                ${data.exprs.join('\n')}
                ${data.startingRule ? 'if (.not. acceptEOF()) cycle' : ''}
                ${data.resultExpr}
`;

/**
 *
 * @param {{
 *  expr: string;
 *  destination: string
 *  quantifier?: string;
 * }} data
 * @returns
 */
export const strExpr = (data) => {
    if (!data.quantifier) {
        return `
                lexemeStart = cursor
                if(.not. ${data.expr}) cycle
                ${data.destination} = consumeInput()
        `;
    }
    switch (data.quantifier) {
        case '+':
            return `
                lexemeStart = cursor
                if (.not. ${data.expr}) cycle
                do while (.not. cursor > len(input))
                    if (.not. ${data.expr}) exit
                end do
                ${data.destination} = consumeInput()
            `;
        case '*':
            return `
                lexemeStart = cursor
                do while (.not. cursor > len(input))
                    if (.not. ${data.expr}) exit
                end do
                ${data.destination} = consumeInput()
            `;
        case '?':
            return `
                lexemeStart = cursor
                if (.not. ${data.expr}) then
                end if
                ${data.destination} = consumeInput()
            `;
        default:
            throw new Error(
                `'${data.quantifier}' quantifier needs implementation`
            );
    }
};

/**
 *
 * @param {{
 * exprIterator: string;
 * iterador: string;
*  expr: string;
*  delimiter?: string;
*  destination: string
*  quantifier?: string;
* }} data
* @returns
*/
export const strExprDelimiter = (data) => {
    if(data.delimiter !== ''){
        return `${data.destination} = ''
                lexemeStart = cursor
                do ${data.iterador} = 1, ${data.exprIterator}
                    if(.not. ${data.expr}) then
                        skipCase = .true.
                        exit
                    end if
                    ${data.destination} =  ${data.destination}//consumeInput()
                    lexemeStart = cursor
                    if(${data.iterador} < ${data.exprIterator}) then
                        if(.not. ${data.delimiter}) then
                            skipCase = .true.
                            exit
                        end if
                        tmp = consumeInput()
                        lexemeStart = cursor
                    end if
                end do
                if(skipCase) cycle
                `;
    }
    return `lexemeStart = cursor
            do ${data.iterador} = 1, ${data.exprIterator}
               if(.not. ${data.expr}) then
                     skipCase = .true.
                     exit
                end if
               
            end do
            if(skipCase) cycle
            ${data.destination} = consumeInput()`;
            
};

/**
 *
 * @param {{
 *  exprs: string[];
 * }} data
 * @returns
 */
export const strResultExpr = (data) => `
                res = ${data.exprs.map((expr) => `toStr(${expr})`).join('//')}
`;

/**
 *
 * @param {{
 *  fnId: string;
 *  exprs: string[];
 * }} data
 * @returns
 */
export const fnResultExpr = (data) => `
                res = ${data.fnId}(${data.exprs.join(', ')})
`;

/**
 *
 * @param {{
 *  ruleId: string;
 *  choice: number
 *  signature: string[];
 *  returnType: string;
 *  paramDeclarations: string[];
 *  code: string;
 * }} data
 * @returns
 */
export const action = (data) => {
    const signature = data.signature.join(', ');
    return `
    function peg_${data.ruleId}_f${data.choice}(${signature}) result(res)
        ${data.paramDeclarations.join('\n')}
        ${data.returnType} :: res
        ${data.code}
    end function peg_${data.ruleId}_f${data.choice}
    `;
};