precision highp float;

// uniform int START_N;
// uniform int MAX_N;
// uniform int BLUE_JUMP;

out vec4 fragColor;


ivec2 relSquare(int i);
ivec2 absSquare(int i, int n);
ivec2 circle4(int i);
vec2 multI(vec2 z);
int lerp(int x, int y, int a);
float hash12(vec2 p);
int jumpFunc(int n);

#define SETTLED_THRESHOLD (0.01 * radius)

void handleNeighbour(ivec2 otherCoord, ivec2 coord, vec2 fcoord, inout bool first, inout float minValue)
{
    vec4 otherVal = texelFetch(bufferA, otherCoord, 0);


    float f = otherVal.x;
    VAL forwardDerivative = VAL(2. * SETTLED_THRESHOLD, 0);

    vec3 currentPosition = projMat * vec3(fcoord, f);

    
        
    #if 1
    if(coord != otherCoord)
    {
        VAL rightDerivative = R(transpose(mat2x3(currentPosition, projMat[0])));
        VAL upDerivative = R(transpose(mat2x3(currentPosition, projMat[1])));
        forwardDerivative = R(transpose(mat2x3(currentPosition, projMat[2])));

        vec2 pixelGradient = vec2(rightDerivative[1], upDerivative[1]);

        // R = 0
        // dR = 0
        // dr * dR/dr + du * dR/du + df * dR/df = 0
        // df = -(dr * dR/dr + du * dR/du) / (dR/df)
        float df = -dot(pixelGradient, vec2(otherCoord - coord)) / forwardDerivative[1];

        f += df;
    }
    #endif

    // Newton's method iterations.
    // Do more iterations when 'other' is blue.
    for(int i = 0; i < 40 && abs(forwardDerivative[0]) > SETTLED_THRESHOLD; i++)
    {
        forwardDerivative = R(transpose(mat2x3(projMat * vec3(fcoord, f), projMat[2])));

        f = f - forwardDerivative[0] / forwardDerivative[1];
    }

    if(isnan(f)) return;

    currentPosition = projMat * vec3(fcoord, f);
    forwardDerivative = R(transpose(mat2x3(currentPosition, projMat[2])));


    float absR = abs(forwardDerivative[0]);
    bool settled = absR < SETTLED_THRESHOLD;

    if(first || settled || !IS_SETTLED(fragColor))
    {
        float valueToMinimize = 0.;
        if(settled || true)
        {
            float forwardDir = dot(projMat[2], currentPosition);
            valueToMinimize = forwardDir;

            if(!IS_SETTLED(fragColor))
            {
                first = true;
            }
        }
        else
        {
            valueToMinimize = absR;
        }
        
        if(first || valueToMinimize < minValue)
        {
            fragColor.x = f;
            fragColor = AS(fragColor, settled ? SETTLED : UNSETTLED);

            first = false;
            minValue = valueToMinimize;
        }
    }
    // return zeroDet;
}

void main( void )
{    
    vec2 fcoord = /*floor*/(gl_FragCoord.xy - vec2(resolution)/2.);
    ivec2 coord = ivec2(gl_FragCoord.xy);


    if(frame == 0)
    {
        const float initF = 0.;

        fragColor = vec4(initF, 0, 0, UNSETTLED);

        return;
    }

    bool first = true;
    float minValue = 0.;


    fragColor = AS(fragColor, UNSETTLED);

    // Run once for otherCoord = coord
    handleNeighbour(coord, coord, fcoord, first, minValue);

    for(int n = 0; n < 3; n++)
    // int n = (frame + coord.x + coord.y) % 2;
    {
        int jf = 1 + n;

        #ifdef DISABLE_STOCHASTIC
        {
            for(int i = 1; i < 8; i += 1 /* variable (1, 2) */)
            {
                ivec2 otherCoord = coord + jf * relSquare(i);

                if(any(lessThan(otherCoord, ivec2(0))) || any(greaterThanEqual(otherCoord, resolution))) continue;


                handleNeighbour(otherCoord, coord, fcoord, first, minValue);
            }
        }
        // else
        #else
        {
            int i = 1 + 2 * (int(100. * hash12(vec2(2 * frame + 1, coord.x + resolution.x * coord.y) / 100.)) % 4);
            // int i = 1 + 2 * (((3 * frame + START_N) + coord.x + resolution.x * coord.y) % 4);
            {
                ivec2 otherCoord = coord + jf * relSquare(i);

                if(any(lessThan(otherCoord, ivec2(0))) || any(greaterThanEqual(otherCoord, resolution))) continue;


                handleNeighbour(otherCoord, coord, fcoord, first, minValue);
            }
        }
        #endif
    }
}


ivec2 relSquare(int i)
{
    return clamp(abs((ivec2(0, 2) + i) % 8 - 3) - 2, -1, 1);
}

ivec2 absSquare(int i, int n)
{
    if(n <= 0)
    {
        n++;  // weird
        return ivec2(0);
    }
    return clamp(abs((ivec2(0, 2*n) + i) % (8*n) - 3*n) - 2*n, -n, n);
}

ivec2 circle4(int i)
{
    i = (i%4 + 4) % 4;
    return ivec2(abs(2-i)-1, 1-abs(i-1));
}

vec2 multI(vec2 z)
{
    return vec2(-z.y, z.x);
}

int lerp(int x, int y, int a) { return (1-a)*x + a*y; }


// https://www.shadertoy.com/view/4djSRW
float hash12(vec2 p)
{
	vec3 p3  = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}


int jumpFunc(int n) { return n*n*n; }
// n
// n*n, sqi(n)
// n*n*n
// (1 << n)
// sign(n) * (1 << (n - 1))
// sign(n) * int(pow(3., float(n-1)))
// sign(n) * (1 << (2*(n - 1)))
// n*(1 << (n-1))

