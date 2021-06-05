precision highp float;

uniform float projScale;

out vec4 fragColor;

void main( void )
{
    ivec2 coord = ivec2(gl_FragCoord);

    vec4 val = texelFetch(bufferA, coord, 0);

    // if(!ISNONE(val.z))
    // {
    //     fragColor = vec4(1, 0, 0, 1);
    //     return;
    // }

    if(!IS_SETTLED(val))
    {
        fragColor = vec4(0);  // vec4(0.5 * val.xyw + 0.5, 1);  // vec4(0);
        return;
    }

    vec3 currentPosition = projMat * vec3(gl_FragCoord.xy - vec2(resolution)/2., val.x);

    VAL xDerivative = R(transpose(mat2x3(currentPosition, vec3(1, 0, 0))));
    VAL yDerivative = R(transpose(mat2x3(currentPosition, vec3(0, 1, 0))));
    VAL zDerivative = R(transpose(mat2x3(currentPosition, vec3(0, 0, 1))));

    vec3 normal = normalize(vec3(xDerivative[1], yDerivative[1], zDerivative[1]));

    // if(forwardDerivative[0] > 1.)
    // {
    //     fragColor = vec4(1, 1, 0, 1);
    //     return;
    // }


    fragColor = vec4(vec3(dot(normal, vec3(1, 0, 0)) / 2. + 0.5), 1);
}